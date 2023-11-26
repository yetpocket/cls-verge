use serde_yaml::{Mapping, Value};

pub fn use_tun(mut config: Mapping, ui_has_tun_enable: bool) -> Mapping {
    if !ui_has_tun_enable {
        // 关闭tun
        config.remove("tun");
        return config;
    }
    // 如果配置文件没有
    // tun:
    //  enable: true
    // 且开启tun功能，verge自己添加tun配置
    // 否则使用配置文件中的tun配置
    let config_tun = config.get("tun");
    let config_has_valid_tun =
        config_tun.is_some_and(|f| f.get("enable").is_some_and(|f| f.is_bool()));
    let mut tun_val = Value::Mapping(Mapping::new());
    match config_tun {
        Some(tun) if config_has_valid_tun => {
            tun_val = tun.clone();
        }
        _ => {
            tun_val["enable"] = true.into();
            tun_val["stack"] = "gvisor".into();
            tun_val["dns-hijack"] = vec!["any:53"].into();
            tun_val["auto-route"] = true.into();
            tun_val["auto-detect-interface"] = true.into();
        }
    }
    config.insert("tun".into(), tun_val);
    // 如果配置文件没有
    // dns:
    //  enable: true
    // 且开启tun功能，verge自己添加dns配置
    // 否则使用配置文件中的tun配置
    let dns_config = config.get("dns");
    let mut dns = Value::Mapping(Mapping::new());
    if dns_config.is_none() {
        use_dns_for_tun(&mut dns);
    } else {
        dns = dns_config.unwrap().clone();
    }
    config.insert("dns".into(), dns);
    return config;
}

fn use_dns_for_tun(dns: &mut Value) {
    let mut value = Value::Mapping(Mapping::new());
    // 开启tun将同时开启dns
    value["enable"] = true.into();
    value["enhanced-mode"] = "fake-ip".into();
    value["fake-ip-range"] = "198.18.0.1/16".into();
    value["nameserver"] = vec!["114.114.114.114", "223.5.5.5"].into();
    value["fallback"] = (vec![] as Vec<String>).into();

    #[cfg(target_os = "windows")]
    {
        value["fake-ip-filter"] = vec![
            "dns.msftncsi.com",
            "www.msftncsi.com",
            "www.msftconnecttest.com",
        ]
        .into();
    }
    *dns = value;
}
