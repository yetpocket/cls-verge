#![cfg(target_os = "windows")]

use crate::config::Config;
use crate::utils::dirs;
use anyhow::{bail, Context};
use deelevate::{PrivilegeLevel, Token};
use runas::Command as RunasCommand;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::time::Duration;
use std::{env::current_exe, process::Command as StdCommand};
use tokio::time::sleep;

const SERVICE_URL: &str = "http://127.0.0.1:33211";

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResponseBody {
    pub core_type: Option<String>,
    pub bin_path: String,
    pub config_dir: String,
    pub log_file: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct JsonResponse {
    pub code: u64,
    pub msg: String,
    pub data: Option<ResponseBody>,
}

/// Install the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
pub async fn install_service() -> anyhow::Result<()> {
    let binary_path = dirs::service_path()?;
    let install_path = binary_path.with_file_name("install-service.exe");

    if !install_path.exists() {
        bail!("installer exe not found");
    }

    let token = Token::with_current_process()?;
    let level = token.privilege_level()?;
    let mut is_runas = false;
    let status = match level {
        PrivilegeLevel::NotPrivileged => {
            is_runas = true;
            RunasCommand::new(install_path).show(false).status()?
        }
        _ => StdCommand::new(install_path)
            .creation_flags(0x08000000)
            .status()?,
    };

    // 从非admin提权到admin，走runas
    // runas似乎总是返回-1
    // 这种情况认为操作成功
    if !status.success() && !(is_runas && status.code().is_some_and(|c| c == -1)) {
        bail!(
            "failed to install service with status {}",
            status.code().unwrap()
        );
    }

    Ok(())
}

/// Uninstall the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
pub async fn uninstall_service() -> anyhow::Result<()> {
    let binary_path = dirs::service_path()?;
    let uninstall_path = binary_path.with_file_name("uninstall-service.exe");

    if !uninstall_path.exists() {
        bail!("uninstaller exe not found");
    }

    let token = Token::with_current_process()?;
    let level = token.privilege_level()?;
    let mut is_runas = false;
    let status = match level {
        PrivilegeLevel::NotPrivileged => {
            is_runas = true;
            RunasCommand::new(uninstall_path).show(false).status()?
        }
        _ => StdCommand::new(uninstall_path)
            .creation_flags(0x08000000)
            .status()?,
    };
    // 从非admin提权到admin，走runas
    // runas似乎总是返回-1
    // 这种情况认为操作成功
    if !status.success() && !(is_runas && status.code().is_some_and(|c| c == -1)) {
        bail!(
            "failed to uninstall service with status {}",
            status.code().unwrap()
        );
    }

    Ok(())
}

/// check the windows service status
pub async fn check_service() -> anyhow::Result<JsonResponse> {
    let url = format!("{SERVICE_URL}/get_clash");
    let response = reqwest::ClientBuilder::new()
        .no_proxy()
        .build()?
        .get(url)
        .send()
        .await?
        .json::<JsonResponse>()
        .await?;

    Ok(response)
}

/// start the clash by service
pub(super) async fn run_core_by_service(config_file: &PathBuf) -> anyhow::Result<()> {
    let status = check_service().await?;

    if status.code == 0 {
        stop_core_by_service().await?;
        sleep(Duration::from_secs(1)).await;
    }

    let clash_core =  Config::verge().latest().clash_core.clone();

    let clash_bin = format!("{clash_core}.exe");
    let bin_path = current_exe()?.with_file_name(clash_bin);
    let bin_path = dirs::path_to_str(&bin_path)?;

    let config_dir = dirs::app_home_dir()?;
    let config_dir = dirs::path_to_str(&config_dir)?;

    let log_path = dirs::service_log_file()?;
    let log_path = dirs::path_to_str(&log_path)?;

    let config_file = dirs::path_to_str(config_file)?;

    let mut map = HashMap::new();
    map.insert("core_type", clash_core.as_str());
    map.insert("bin_path", bin_path);
    map.insert("config_dir", config_dir);
    map.insert("config_file", config_file);
    map.insert("log_file", log_path);

    let url = format!("{SERVICE_URL}/start_clash");
    let res = reqwest::ClientBuilder::new()
        .no_proxy()
        .build()?
        .post(url)
        .json(&map)
        .send()
        .await?
        .json::<JsonResponse>()
        .await
        .context("failed to connect to the Clash Verge Service")?;

    if res.code != 0 {
        bail!(res.msg);
    }

    Ok(())
}

/// stop the clash by service
pub(super) async fn stop_core_by_service() -> anyhow::Result<()> {
    let url = format!("{SERVICE_URL}/stop_clash");
    let res = reqwest::ClientBuilder::new()
        .no_proxy()
        .build()?
        .post(url)
        .send()
        .await?
        .json::<JsonResponse>()
        .await?;

    if res.code != 0 {
        bail!(res.msg);
    }

    Ok(())
}
