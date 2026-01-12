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
            // Generates ~4 character alphanumeric string (e.g. "K92X")
            const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
            return `EHUTI-${randomCode}`;
        };

        const tryCreatePeer = () => {
            const fullId = generateShortId();
            console.log("Blocking ID:", fullId);

            this.peer = new Peer(fullId);

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
                // If ID is taken, try a new one
                if (err.type === 'unavailable-id') {
                    console.log('ID Collision, retrying...');
                    this.peer.destroy();
                    tryCreatePeer();
                } else if (err.type === 'peer-unavailable') {
                    // This happens in joinGame if host not found
                    if (this.errorCallback) this.errorCallback('Host not found.');
                } else {
                    if (this.errorCallback) this.errorCallback(`Connection Error: ${err.type}`);
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
        console.log('Connecting to ' + hostId);

        const tryConnect = () => {
            const conn = this.peer.connect(hostId);
            this.handleConnection(conn);

            // Timeout safety
            setTimeout(() => {
                if (!this.conn || !this.conn.open) {
                    if (this.errorCallback) this.errorCallback("Connection timed out.");
                }
            }, 5000);
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
