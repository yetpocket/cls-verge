use serde::{Deserialize, Serialize};

/// Define the `profiles.yaml` schema
#[derive(Default, Debug, Clone, Deserialize, Serialize)]
pub struct ProfilesConfig {
  /// current profile's name
  pub current: Option<u32>,

  /// profile list
  pub items: Option<Vec<ProfileItem>>,
}

#[derive(Default, Debug, Clone, Deserialize, Serialize)]
pub struct ProfileItem {
  /// profile name
  pub name: Option<String>,
  /// profile file
  pub file: Option<String>,
  /// current mode
  pub mode: Option<String>,
  /// source url
  pub url: Option<String>,
  /// selected infomation
  pub selected: Option<Vec<ProfileSelected>>,
  /// user info
  pub extra: Option<ProfileExtra>,
}

#[derive(Default, Debug, Clone, Deserialize, Serialize)]
pub struct ProfileSelected {
  pub name: Option<String>,
  pub now: Option<String>,
}

#[derive(Default, Debug, Clone, Copy, Deserialize, Serialize)]
pub struct ProfileExtra {
  pub upload: u64,
  pub download: u64,
  pub total: u64,
  pub expire: u64,
}