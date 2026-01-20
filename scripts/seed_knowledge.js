
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

const knowledgeData = [
    {
        question: "รหัส Wifi โรงเรียนอะไร",
        answer: "🔐 **Rachawinit-WiFi**\nUser: `crms6-guest`\nPass: `crms6@2024`\n(สำหรับแขกผู้มาเยือน)\n\nหรือใช้ **CRMS6-Staff** (Login ด้วย User อินเทอร์เน็ตโรงเรียน)",
        keywords: ["wifi", "internet", "รหัส", "ไวไฟ", "เน็ต"],
        category: "Network"
    },
    {
        question: "ปริ้นเตอร์ไม่ออกทำยังไง",
        answer: "🖨️ **วิธีแก้ปัญหาเบื้องต้น:**\n1. เช็คว่าเสียบสาย USB หรือยัง\n2. เช็คว่ามีกระดาษในถาดไหม\n3. ลอง Restart เครื่องปริ้นเตอร์ 1 ครั้ง\n\nถ้ายังไม่ได้ แจ้งซ่อมได้เลยค่ะ! 🔧",
        keywords: ["print", "printer", "ปริ้น", "ปริ้นเตอร์", "หมึก"],
        category: "Printer"
    },
    {
        question: "ขอเบิกหมึกปริ้นเตอร์",
        answer: "📝 **การเบิกหมึกพิมพ์**\n1. ถ่ายรูปหน้ากล่องหมึก/รุ่นปริ้นเตอร์\n2. แจ้งที่ห้องวิชาการ (ตึก 2 ชั้น 1)\n3. หรือแจ้งซ่อมผ่านระบบนี้ เลือกหมวด 'อุปกรณ์สิ้นเปลือง' ได้เลยค่ะ",
        keywords: ["เบิก", "หมึก", "toner", "หมึกหมด"],
        category: "Consumables"
    },
    {
        question: "ลงโปรแกรม Adobe ยังไง",
        answer: "💾 **Adobe Creative Cloud**\nทางโรงเรียนมี License สำหรับเครื่องราชการค่ะ\n\n➡️ ติดต่อฝ่ายโสตฯ อาคาร 4 ห้อง 411 เพื่อให้เจ้าหน้าที่ Remote ไปติดตั้งให้ค่ะ",
        keywords: ["adobe", "photoshop", "illustrator", "premiere", "ลงโปรแกรม"],
        category: "Software"
    },
    {
        question: "Line Notify สมัครยังไง",
        answer: "📲 **วิธีสมัคร LINE Notify**\n1. เพิ่มเพื่อน LINE Notify\n2. เข้าเว็บ notify-bot.line.me\n3. Login -> My Page -> Generate Token\n4. เลือกลุ่มที่ต้องการส่งข้อความ\n\n(หากต้องการให้ฝ่ายโสตฯ ช่วยตั้งค่า ติดต่อห้อง 411 ค่ะ)",
        keywords: ["line", "notify", "ไลน์", "แจ้งเตือน"],
        category: "Software"
    }
];

async function seedKnowledge() {
    console.log('🌱 Seeding IT Knowledge Base...');
    const collectionRef = db.collection('it_knowledge_base');

    for (const item of knowledgeData) {
        // Create a unique ID based on category and question part
        const docId = `kb_${item.category.toLowerCase()}_${Math.random().toString(36).substr(2, 5)}`;
        await collectionRef.doc(docId).set({
            ...item,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Added: ${item.question}`);
    }

    console.log('✨ Seed complete!');
}

seedKnowledge().catch(console.error);
