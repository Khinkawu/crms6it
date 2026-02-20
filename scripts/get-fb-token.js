const https = require('https');

const userToken = process.argv[2];
if (!userToken) {
    console.log('❌ กรุณาใส่ Token ด้วยครับ');
    console.log('Usage: node scripts/get-fb-token.js <TOKEN>');
    process.exit(1);
}

console.log('🔄 กำลังดึงข้อมูล Page Token...');

const url = `https://graph.facebook.com/v18.0/me/accounts?fields=access_token,name,id&access_token=${userToken}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error('❌ Error:', json.error.message);
            } else {
                console.log('\n✅ สำเร็จ! นี่คือรายชื่อเพจและ Token ของคุณ:\n');
                console.log(JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.log('Raw Response:', data);
        }
    });
}).on('error', (err) => {
    console.error('❌ Error:', err.message);
});
