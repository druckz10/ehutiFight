import Peer from 'peerjs';

class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.connectionCallback = null;
        this.dataCallback = null;
        this.errorCallback = null; // Fix generic callback
        this.myId = null;
        this.logs = [];
    }

    log(msg) {
        console.log(msg);
        this.logs.push(msg);
        if (this.logs.length > 10) this.logs.shift(); // Keep last 10
    }

    getLogs() {
        return this.logs.join('\n');
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
            this.log("Init ID: " + fullId);

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
                this.log('My ID: ' + id);
                this.myId = id;
            });

            this.peer.on('connection', (conn) => {
                this.log('Incoming conn...');
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                this.log('Err: ' + err.type);
                if (err.type === 'unavailable-id') {
                    this.log('ID Taken, retry...');
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
        if (!this.myId) {
            this.peer.on('open', (id) => { });
        }
        return this.myId ? this.myId.replace('EHUTI-', '') : null;
    }

    joinGame(shortCode, onConnected, onError) {
        this.isHost = false;
        this.connectionCallback = onConnected;
        this.errorCallback = onError;

        const hostId = `EHUTI-${shortCode}`;
        this.log(`Joining: ${hostId}`);

        const tryConnect = () => {
            // Attempt JSON serialization for better firewall headers
            // Reliable: false is faster and often penetrates NAT better
            const conn = this.peer.connect(hostId, {
                reliable: false,
                serialization: 'json'
            });
            this.handleConnection(conn);

            setTimeout(() => {
                if (!this.conn || !this.conn.open) {
                    if (this.errorCallback) this.errorCallback("Timeout. Try different WiFi/LTE.");
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
            this.log('Connected!');
            if (this.connectionCallback) this.connectionCallback();
        });

        this.conn.on('data', (data) => {
            if (this.dataCallback) this.dataCallback(data);
        });

        this.conn.on('close', () => {
            this.log('Conn closed');
        });

        this.conn.on('error', (err) => {
            this.log('Conn Err: ' + err);
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
