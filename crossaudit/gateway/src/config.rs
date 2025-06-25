pub struct Settings {
    pub server_addr: String,
}

impl Settings {
    pub fn from_env() -> Self {
        Settings { server_addr: "0.0.0.0:8000".into() }
    }
}
