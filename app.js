const express = require('express');
const path = require('path');
const axios = require('axios');
const {query, pool} = require('./data_base');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const WebSocket = require('ws');

const p = console.log; // for debug
const app = express();
const wss = new WebSocket.Server({ port: 8080 });
const port = 3001;
const host = '0.0.0.0';
const SECRET_KEY = 'auhgauwvbfaiueyfbcawcfanwuefibawufbca';

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(`./front`));
app.use(async (req, res, next) => {
    console.log(`Request Method: ${req.method}, Request URL: ${req.url}`);
    next();
});

app.post('/signup', async(req, res)=>{
    if(!req.body.name || req.body.name.length == 0 || !req.body.password) {
        return res.status(400).json({ error: "Name or password is empty."});
    }
    const name = req.body.name;
    const password = req.body.password;
    if((await query(`select id from "user" where name like '${name}'`)).length > 0) {
        return res.status(500).json({ error: "Name is used before."});
    }
    if(password.length < 3) {
        return res.status(500).json({ error: "password must be greter than or equal to 3."});
    }
    await query(`insert into "user"(name, password) values('${name}', '${password}')`);

    res.redirect(`login.html`);
})

app.post('/login', async(req, res)=>{
    if(!req.body.name || req.body.name.length == 0 || !req.body.password) {
        return res.status(500).json({ error: "Name or password is empty."});
    }
    const name = req.body.name;
    const password = req.body.password;
    let user = await query(`select * from "user" where name like '${name}' and password = '${password}'`);
    if(user.length == 0) {
        return res.status(500).json({ error: "wrong name or password"});
    }
    user = user[0];
    
    const token = jwt.sign(user, SECRET_KEY, { expiresIn: '1h' });

    res.json({ token });
})

app.get('/messages', async(req, res)=>{
    const data =
    await query(`select "message".content as "message", "user".name as "username", "message".date as "date" from "message" join "user"
        on "message".user_id = "user".id`);
    res.json({ data }); // data = [{message, username, date}, ...]
})

async function check(user) {
    if(!user || !user.id || !user.name || !user.password)
        return false;
    return await query(`select * from "user" where id=${user.id}`).length > 0;
}

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) return res.status(401).json({ error: 'Token missing' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        
        req.user = user;
        
        next();
    });
};

app.post(`/send_message`, authenticateToken, async(req, res)=>{
    const user = req.user;
    if(!check(user)) {
        return res.status(500).json({ error: "Login first" });
    }
    const content = req.body.content;
    if(!content || content.length == 0)
        res.status(500).json({ error: "Content not found" });

    await query(`insert into "message"(content, user_id) values('${content}', ${user.id})`);

    res.json({ message: "message send" })
})

// client webSocket
wss.on('connection', (ws) => {
    p("A new client connected!");
    ws.on('message', (message) => p("Received:", message));
    ws.on('close', () => p("Client disconnected."));
    ws.on('error', (err) => p("WebSocket error:", err));
})
wss.on('error', (err) => {
    console.error("WebSocket server error:", err);
});

// webSocket
const sebSocket = async() => {
    // database
    const req = await pool.connect();
    await req.query('listen new_message');

    req.on('notification', (msg) => {
        wss.clients.forEach(client => {
            if(client.readyState === WebSocket.OPEN) {
                client.send(msg.payload);
            }
        });
    })
    req.on('error', (err) => {
        console.error("error in webSocket", err);
    })
}

app.listen(port, host, async(err) => {
    if (err) {
        console.error('Server error:', err);
        process.exit(-1);
    }
    await sebSocket();
    console.log(`App running at http://${host}:${port}`);
});
