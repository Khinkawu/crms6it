/**
 * Facebook Page Access Token Refresh Script
 * 
 * วิธีใช้:
 * 1. ไปที่ https://developers.facebook.com/tools/explorer/
 * 2. เลือก App "CRMS6 Content Poster"
 * 3. กด "Generate Access Token" และให้ permissions ที่ต้องการ
 * 4. Copy User Access Token ที่ได้
 * 5. รันสคริปนี้: node scripts/refresh-facebook-token.js YOUR_USER_ACCESS_TOKEN
 * 6. Copy Page Access Token ที่ได้ไปใส่ใน .env.local
 * 
 * Token ที่ได้จะเป็น Long-Lived Token (60 วัน)
 */

const APP_ID = process.env.FACEBOOK_APP_ID || 'YOUR_APP_ID';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'YOUR_APP_SECRET';
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || 'YOUR_PAGE_ID';

async function main() {
    const userToken = process.argv[2];

    if (!userToken) {
        console.log('❌ กรุณาใส่ User Access Token');
        console.log('');
        console.log('วิธีใช้: node scripts/refresh-facebook-token.js YOUR_USER_ACCESS_TOKEN');
        console.log('');
        console.log('ขั้นตอนดึง User Access Token:');
        console.log('1. ไปที่ https://developers.facebook.com/tools/explorer/');
        console.log('2. เลือก App ของคุณ');
        console.log('3. เลือก Permissions: pages_manage_posts, pages_read_engagement');
        console.log('4. กด "Generate Access Token"');
        console.log('5. Copy token มาใส่ในคำสั่ง');
        process.exit(1);
    }

    console.log('🔄 กำลังแปลงเป็น Long-Lived Token...');

    try {
        // Step 1: Exchange short-lived token for long-lived token
        const longLivedRes = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${APP_ID}&` +
            `client_secret=${APP_SECRET}&` +
            `fb_exchange_token=${userToken}`
        );

        const longLivedData = await longLivedRes.json();

        if (longLivedData.error) {
            console.error('❌ Error:', longLivedData.error.message);
            process.exit(1);
        }

        const longLivedUserToken = longLivedData.access_token;
        console.log('✅ ได้ Long-Lived User Token แล้ว');

        // Step 2: Get Page Access Token
        console.log('🔄 กำลังดึง Page Access Token...');

        const pageRes = await fetch(
            `https://graph.facebook.com/v18.0/${PAGE_ID}?` +
            `fields=access_token&` +
            `access_token=${longLivedUserToken}`
        );

        const pageData = await pageRes.json();

        if (pageData.error) {
            console.error('❌ Error:', pageData.error.message);
            process.exit(1);
        }

        const pageAccessToken = pageData.access_token;

        console.log('');
        console.log('✅ สำเร็จ! นี่คือ Page Access Token ใหม่ของคุณ:');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(pageAccessToken);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📝 Copy token ด้านบนไปใส่ใน .env.local:');
        console.log('   FACEBOOK_PAGE_ACCESS_TOKEN=' + pageAccessToken.substring(0, 30) + '...');
        console.log('');
        console.log('⏰ Token นี้จะหมดอายุใน 60 วัน');
        console.log('   รันสคริปนี้อีกครั้งก่อนหมดอายุเพื่อต่ออายุ');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
