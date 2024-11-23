// import pkg from 'pg';
// const { Pool } = pkg;

const pkg = require('pg');
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'messenger',
    password: '123',
    port: 5432,
});

async function query(q) {
    try {
        return (await pool.query(q)).rows;
    } catch (err) {
        console.error(err.stack);
    }
}

module.exports = {query, pool};
