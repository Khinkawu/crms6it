---
name: line-flex-message
description: Generate LINE Flex Message JSON for repair jobs, booking status, and notifications. Provides templates and prompts for creating beautiful LINE cards.
---

# LINE Flex Message Skill

This skill helps generate LINE Flex Message JSON for the CRMS6 IT system, creating beautiful interactive cards for repair updates, booking confirmations, and notifications.

## 1. Flex Message Basics

### Structure Overview
```
FlexMessage
├── altText (required - shown in notification)
└── contents (FlexContainer)
    ├── type: "bubble" (single card) or "carousel" (multiple cards)
    ├── header (optional)
    ├── hero (optional - image)
    ├── body (main content)
    └── footer (optional - action buttons)
```

### Size Options
- `nano`: Extra small (for compact messages)
- `micro`: Very small
- `kilo`: Small
- `mega`: Default
- `giga`: Large

---

## 2. Repair Job Status Templates

### Template: Repair Status Update

```json
{
  "type": "flex",
  "altText": "อัปเดตสถานะงานซ่อม #REP-001",
  "contents": {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#27ACB2",
      "paddingAll": "15px",
      "contents": [
        {
          "type": "text",
          "text": "🔧 งานซ่อม #REP-001",
          "color": "#FFFFFF",
          "weight": "bold",
          "size": "lg"
        }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "spacing": "md",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "text",
              "text": "สถานะ",
              "color": "#8C8C8C",
              "size": "sm",
              "flex": 2
            },
            {
              "type": "text",
              "text": "กำลังดำเนินการ",
              "color": "#27ACB2",
              "weight": "bold",
              "size": "sm",
              "flex": 3
            }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "text",
              "text": "รายการ",
              "color": "#8C8C8C",
              "size": "sm",
              "flex": 2
            },
            {
              "type": "text",
              "text": "เปลี่ยนหลอดไฟห้องประชุม A",
              "size": "sm",
              "flex": 3,
              "wrap": true
            }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "text",
              "text": "ผู้รับผิดชอบ",
              "color": "#8C8C8C",
              "size": "sm",
              "flex": 2
            },
            {
              "type": "text",
              "text": "ช่างสมชาย",
              "size": "sm",
              "flex": 3
            }
          ]
        },
        {
          "type": "separator",
          "margin": "lg"
        },
        {
          "type": "text",
          "text": "อัปเดตล่าสุด: 15 ม.ค. 2567 10:30",
          "size": "xs",
          "color": "#AAAAAA",
          "margin": "md"
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "horizontal",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "ดูรายละเอียด",
            "uri": "https://your-domain.vercel.app/repair/REP-001"
          },
          "style": "primary",
          "color": "#27ACB2"
        }
      ]
    }
  }
}
```

### Status Color Mapping

```typescript
const statusColors = {
  pending: '#FFA500',      // Orange - รอดำเนินการ
  in_progress: '#27ACB2',  // Teal - กำลังดำเนินการ
  completed: '#00C851',    // Green - เสร็จสิ้น
  cancelled: '#FF4444',    // Red - ยกเลิก
  on_hold: '#FFBB33',      // Amber - รอชิ้นส่วน/รออนุมัติ
};

const statusLabels = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  on_hold: 'รอดำเนินการต่อ',
};
```

---

## 3. Booking Confirmation Template

```json
{
  "type": "flex",
  "altText": "ยืนยันการจอง - ห้องประชุม A",
  "contents": {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#4A90D9",
      "paddingAll": "15px",
      "contents": [
        {
          "type": "text",
          "text": "📅 ยืนยันการจอง",
          "color": "#FFFFFF",
          "weight": "bold",
          "size": "lg"
        }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "spacing": "md",
      "contents": [
        {
          "type": "text",
          "text": "ห้องประชุม A",
          "weight": "bold",
          "size": "xl"
        },
        {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "margin": "lg",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "📆 วันที่",
                  "size": "sm",
                  "color": "#555555",
                  "flex": 2
                },
                {
                  "type": "text",
                  "text": "15 มกราคม 2567",
                  "size": "sm",
                  "flex": 3
                }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "🕐 เวลา",
                  "size": "sm",
                  "color": "#555555",
                  "flex": 2
                },
                {
                  "type": "text",
                  "text": "09:00 - 12:00",
                  "size": "sm",
                  "flex": 3
                }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "👤 ผู้จอง",
                  "size": "sm",
                  "color": "#555555",
                  "flex": 2
                },
                {
                  "type": "text",
                  "text": "คุณสมศรี",
                  "size": "sm",
                  "flex": 3
                }
              ]
            }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F5F5F5",
          "cornerRadius": "md",
          "paddingAll": "12px",
          "margin": "lg",
          "contents": [
            {
              "type": "text",
              "text": "หมายเหตุ: ต้องการโปรเจคเตอร์และไวท์บอร์ด",
              "size": "sm",
              "wrap": true
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "horizontal",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "ดูปฏิทิน",
            "uri": "https://your-domain.vercel.app/booking"
          },
          "style": "secondary"
        },
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "ยกเลิกการจอง",
            "data": "action=cancel_booking&id=BOOK-001"
          },
          "style": "primary",
          "color": "#FF4444"
        }
      ]
    }
  }
}
```

---

## 4. Photography Job Notification

```json
{
  "type": "flex",
  "altText": "งานถ่ายภาพใหม่ - 15 ม.ค. 2567",
  "contents": {
    "type": "bubble",
    "size": "mega",
    "hero": {
      "type": "image",
      "url": "https://your-domain.vercel.app/images/camera-icon.png",
      "size": "full",
      "aspectRatio": "3:1",
      "aspectMode": "cover",
      "backgroundColor": "#333333"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "spacing": "md",
      "contents": [
        {
          "type": "text",
          "text": "📸 งานถ่ายภาพ",
          "weight": "bold",
          "size": "xl"
        },
        {
          "type": "text",
          "text": "ถ่ายงานประชุมผู้บริหาร",
          "size": "md",
          "color": "#666666",
          "wrap": true
        },
        {
          "type": "separator",
          "margin": "lg"
        },
        {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "margin": "lg",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "📅",
                  "size": "sm",
                  "flex": 1
                },
                {
                  "type": "text",
                  "text": "15 ม.ค. 2567 | 13:00 - 16:00",
                  "size": "sm",
                  "flex": 5
                }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "📍",
                  "size": "sm",
                  "flex": 1
                },
                {
                  "type": "text",
                  "text": "ห้องประชุมใหญ่ ชั้น 5",
                  "size": "sm",
                  "flex": 5
                }
              ]
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "✅ รับงาน",
            "data": "action=accept_job&id=PHOTO-001"
          },
          "style": "primary",
          "color": "#00C851"
        },
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "ดูรายละเอียด",
            "uri": "https://your-domain.vercel.app/my-work"
          },
          "style": "secondary"
        }
      ]
    }
  }
}
```

---

## 5. Helper Function: Generate Flex Messages

```typescript
// lib/lineFlexMessages.ts

interface RepairData {
  id: string;
  title: string;
  status: string;
  assignee?: string;
  updatedAt: Date;
}

export function createRepairStatusFlex(repair: RepairData): FlexMessage {
  const statusColors = {
    pending: '#FFA500',
    in_progress: '#27ACB2',
    completed: '#00C851',
    cancelled: '#FF4444',
  };
  
  const statusLabels = {
    pending: 'รอดำเนินการ',
    in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
  };
  
  const color = statusColors[repair.status] || '#888888';
  const label = statusLabels[repair.status] || repair.status;
  
  return {
    type: 'flex',
    altText: `อัปเดตสถานะงานซ่อม #${repair.id}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: color,
        paddingAll: '15px',
        contents: [{
          type: 'text',
          text: `🔧 งานซ่อม #${repair.id}`,
          color: '#FFFFFF',
          weight: 'bold',
          size: 'lg',
        }],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          createRow('สถานะ', label, color, true),
          createRow('รายการ', repair.title),
          repair.assignee ? createRow('ผู้รับผิดชอบ', repair.assignee) : null,
          { type: 'separator', margin: 'lg' },
          {
            type: 'text',
            text: `อัปเดตล่าสุด: ${formatThaiDate(repair.updatedAt)}`,
            size: 'xs',
            color: '#AAAAAA',
            margin: 'md',
          },
        ].filter(Boolean),
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [{
          type: 'button',
          action: {
            type: 'uri',
            label: 'ดูรายละเอียด',
            uri: `${process.env.NEXT_PUBLIC_BASE_URL}/repair/${repair.id}`,
          },
          style: 'primary',
          color: color,
        }],
      },
    },
  };
}

function createRow(label: string, value: string, valueColor?: string, bold?: boolean) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, color: '#8C8C8C', size: 'sm', flex: 2 },
      { 
        type: 'text', 
        text: value, 
        size: 'sm', 
        flex: 3,
        color: valueColor,
        weight: bold ? 'bold' : 'regular',
        wrap: true,
      },
    ],
  };
}
```

---

## 6. Carousel for Multiple Items

```json
{
  "type": "flex",
  "altText": "งานซ่อมที่รอดำเนินการ 3 รายการ",
  "contents": {
    "type": "carousel",
    "contents": [
      { /* bubble 1 */ },
      { /* bubble 2 */ },
      { /* bubble 3 */ }
    ]
  }
}
```

```typescript
// Generate carousel of pending repairs
function createPendingRepairsCarousel(repairs: RepairData[]) {
  return {
    type: 'flex',
    altText: `งานซ่อมที่รอดำเนินการ ${repairs.length} รายการ`,
    contents: {
      type: 'carousel',
      contents: repairs.slice(0, 10).map(repair => 
        createRepairBubble(repair)
      ),
    },
  };
}
```

---

## 7. LINE Flex Message Simulator

Test your Flex Messages before deploying:

1. Go to: https://developers.line.biz/flex-message-simulator/
2. Paste your JSON
3. Preview on different devices
4. Copy and use in code

---

## 8. Common Patterns

### Action Types

```typescript
// URI Action - Open URL
{
  type: 'uri',
  label: 'ดูเพิ่มเติม',
  uri: 'https://example.com'
}

// Postback Action - Send data back to bot
{
  type: 'postback',
  label: 'รับงาน',
  data: 'action=accept&id=123',
  displayText: 'รับงาน'  // What user sees in chat
}

// Message Action - Send as user message
{
  type: 'message',
  label: 'สอบถามเพิ่มเติม',
  text: 'ต้องการสอบถามเกี่ยวกับงานซ่อม'
}
```

### Responsive Design Tips

```typescript
// Use percentage widths
{ flex: 2 }  // 40% of row
{ flex: 3 }  // 60% of row

// Wrap long text
{ wrap: true, maxLines: 2 }

// Use size options
{ size: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' }
```

---

## 9. Prompts for AI Generation

### Prompt: Generate Repair Status Card
```
Create a LINE Flex Message JSON for a repair job with:
- Job ID: REP-001
- Title: ซ่อมเครื่องปรับอากาศ
- Status: in_progress (กำลังดำเนินการ)
- Assignee: ช่างสมชาย
- Updated: 15 ม.ค. 2567 10:30
- Include a "View Details" button linking to /repair/REP-001
```

### Prompt: Generate Booking Confirmation
```
Create a LINE Flex Message for a booking confirmation:
- Room: ห้องประชุม A
- Date: 15 มกราคม 2567
- Time: 09:00 - 12:00
- Booker: คุณสมศรี
- Notes: ต้องการโปรเจคเตอร์
- Include cancel button with postback
```

---

## 10. Feedback Format

- **[FLEX-SYNTAX]**: JSON syntax error
- **[FLEX-LAYOUT]**: Layout issues, overflow, truncation
- **[FLEX-ACTION]**: Action not working (postback/uri)
- **[FLEX-DESIGN]**: Visual design improvements
