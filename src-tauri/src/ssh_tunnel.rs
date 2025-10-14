use anyhow::{anyhow, Result};
use ssh2::Session;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

/// SSH tunnel connection that forwards local port to remote database
pub struct SshTunnel {
    local_port: u16,
    _thread_handle: Option<thread::JoinHandle<()>>,
    running: Arc<Mutex<bool>>,
}

impl SshTunnel {
    /// Establish SSH tunnel
    /// Returns the local port that forwards to the remote database
    pub fn connect(
        ssh_host: &str,
        ssh_port: u16,
        ssh_username: &str,
        ssh_password: Option<&str>,
        ssh_private_key_path: Option<&str>,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<Self> {
        // Create SSH session
        let tcp = TcpStream::connect(format!("{}:{}", ssh_host, ssh_port))
            .map_err(|e| anyhow!("Failed to connect to SSH server: {}", e))?;
        
        let mut sess = Session::new()
            .map_err(|e| anyhow!("Failed to create SSH session: {}", e))?;
        
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| anyhow!("SSH handshake failed: {}", e))?;

        // Authenticate
        if let Some(password) = ssh_password {
            sess.userauth_password(ssh_username, password)
                .map_err(|e| anyhow!("SSH password authentication failed: {}", e))?;
        } else if let Some(key_path) = ssh_private_key_path {
            sess.userauth_pubkey_file(ssh_username, None, std::path::Path::new(key_path), None)
                .map_err(|e| anyhow!("SSH key authentication failed: {}", e))?;
        } else {
            return Err(anyhow!("No SSH authentication method provided"));
        }

        if !sess.authenticated() {
            return Err(anyhow!("SSH authentication failed"));
        }

        // Find available local port
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| anyhow!("Failed to bind local port: {}", e))?;
        
        let local_port = listener.local_addr()
            .map_err(|e| anyhow!("Failed to get local port: {}", e))?
            .port();

        let remote_host = remote_host.to_string();
        let running = Arc::new(Mutex::new(true));
        let running_clone = running.clone();

        // Start forwarding thread
        let thread_handle = thread::spawn(move || {
            let sess = Arc::new(Mutex::new(sess));
            
            loop {
                // Check if we should stop
                if let Ok(r) = running_clone.lock() {
                    if !*r {
                        break;
                    }
                }

                // Accept incoming connection
                let (mut local_stream, _) = match listener.accept() {
                    Ok(s) => s,
                    Err(_) => continue,
                };

                let sess_clone = sess.clone();
                let remote_host = remote_host.clone();
                let running_clone2 = running_clone.clone();

                // Handle connection in separate thread
                thread::spawn(move || {
                    if let Err(e) = handle_tunnel_connection(
                        &mut local_stream,
                        sess_clone,
                        &remote_host,
                        remote_port,
                        running_clone2,
                    ) {
                        eprintln!("Tunnel connection error: {}", e);
                    }
                });
            }
        });

        Ok(Self {
            local_port,
            _thread_handle: Some(thread_handle),
            running,
        })
    }

    pub fn local_port(&self) -> u16 {
        self.local_port
    }
}

impl Drop for SshTunnel {
    fn drop(&mut self) {
        if let Ok(mut running) = self.running.lock() {
            *running = false;
        }
    }
}

fn handle_tunnel_connection(
    local_stream: &mut TcpStream,
    sess: Arc<Mutex<Session>>,
    remote_host: &str,
    remote_port: u16,
    running: Arc<Mutex<bool>>,
) -> Result<()> {
    let sess = sess.lock()
        .map_err(|e| anyhow!("Failed to lock session: {}", e))?;

    let mut channel = sess.channel_direct_tcpip(remote_host, remote_port, None)
        .map_err(|e| anyhow!("Failed to create SSH channel: {}", e))?;

    // Forward data between local stream and SSH channel
    let mut local_buf = [0u8; 8192];
    let mut remote_buf = [0u8; 8192];

    local_stream.set_nonblocking(true)
        .map_err(|e| anyhow!("Failed to set non-blocking: {}", e))?;
    channel.set_read_timeout(Some(std::time::Duration::from_millis(100)))
        .map_err(|e| anyhow!("Failed to set timeout: {}", e))?;

    loop {
        // Check if we should stop
        if let Ok(r) = running.lock() {
            if !*r {
                break;
            }
        }

        // Forward from local to remote
        match local_stream.read(&mut local_buf) {
            Ok(0) => break, // Connection closed
            Ok(n) => {
                channel.write_all(&local_buf[..n])
                    .map_err(|e| anyhow!("Failed to write to channel: {}", e))?;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(e) => return Err(anyhow!("Failed to read from local: {}", e)),
        }

        // Forward from remote to local
        match channel.read(&mut remote_buf) {
            Ok(0) => break, // Connection closed
            Ok(n) => {
                local_stream.write_all(&remote_buf[..n])
                    .map_err(|e| anyhow!("Failed to write to local: {}", e))?;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(e) => return Err(anyhow!("Failed to read from channel: {}", e)),
        }

        std::thread::sleep(std::time::Duration::from_millis(10));
    }

    Ok(())
}
