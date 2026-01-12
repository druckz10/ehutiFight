import Peer from 'peerjs';

class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.connectionCallback = null;
        this.dataCallback = null;
        this.myId = null;
    }

    initialize() {
        if (this.peer) return; // Prevent double init

        const generateShortId = () => {
            // Generate 4 random digits
            return Math.floor(1000 + Math.random() * 9000).toString();
        };

        const tryCreatePeer = () => {
            const shortId = generateShortId();
            const fullId = `EHUTI-${shortId}`;
            console.log("Blocking ID:", fullId);

            const peerConfig = {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            };

            this.peer = new Peer(fullId, peerConfig);

            this.peer.on('open', (id) => {
                console.log('My peer ID is: ' + id);
                this.myId = id;
            });

            this.peer.on('connection', (conn) => {
                console.log('Incoming connection...');
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                if (err.type === 'unavailable-id') {
                    console.log('ID Collision, retrying...');
                    this.peer.destroy();
                    tryCreatePeer();
                } else if (err.type === 'peer-unavailable') {
                    if (this.errorCallback) this.errorCallback(`Host ${shortId} not found/offline.`);
                } else if (err.type === 'network') {
                    if (this.errorCallback) this.errorCallback("Network Error. Check WiFi.");
                } else {
                    if (this.errorCallback) this.errorCallback(`Error: ${err.type}`);
                }
            });
        };

        tryCreatePeer();
    }

    hostGame(onConnected) {
        this.isHost = true;
        this.connectionCallback = onConnected;
        // Wait for 'open' event if not already open
        if (!this.myId) {
            this.peer.on('open', (id) => {
                // Ready to be joined
            });
        } else {
            // Already has ID, just waiting for connection
        }
        // Return only the suffix for display
        return this.myId ? this.myId.replace('EHUTI-', '') : null;
    }

    joinGame(shortCode, onConnected, onError) {
        this.isHost = false;
        this.connectionCallback = onConnected;
        this.errorCallback = onError;

        const hostId = `EHUTI-${shortCode}`;
        console.log(`Attempting to join: ${hostId}`);

        const tryConnect = () => {
            const conn = this.peer.connect(hostId);
            this.handleConnection(conn);

            // Timeout safety
            setTimeout(() => {
                if (!this.conn || !this.conn.open) {
                    if (this.errorCallback) this.errorCallback("Connection timed out. (15s)");
                }
            }, 15000);
        };

        if (this.peer.open) {
            tryConnect();
        } else {
            this.peer.on('open', () => {
                tryConnect();
            });
        }
    }

    handleConnection(conn) {
        this.conn = conn;

        this.conn.on('open', () => {
            console.log('Connected!');
            if (this.connectionCallback) this.connectionCallback();
        });

        this.conn.on('data', (data) => {
            if (this.dataCallback) this.dataCallback(data);
        });

        this.conn.on('close', () => {
            console.log('Connection closed');
            // Handle disconnect
        });
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    onData(callback) {
        this.dataCallback = callback;
    }

    // In handleConnection above:
    // if (this.dataCallback) this.dataCallback(data);
    // This is already checked, so just updating onData is enough,
    // but I'll make explicit it accepts null.
    // actually, let's verify handleConnection uses the check.
    // Yes lines 90-91: if (this.dataCallback) ...
    // So simply calling onData(null) works.

    cleanUp() {
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.myId = null;
        this.isHost = false;
        this.connectionCallback = null;
        this.errorCallback = null;
    }
}

export default new NetworkManager();
