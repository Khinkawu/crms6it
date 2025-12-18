/**
 * Professional LINE Flex Message Templates
 * Unified design system for all LINE notifications
 */

// Brand Colors
const COLORS = {
    primary: '#2563EB',      // Blue
    success: '#059669',      // Emerald
    warning: '#D97706',      // Amber
    danger: '#DC2626',       // Red
    info: '#0891B2',         // Cyan
    purple: '#7C3AED',       // Purple
    dark: '#1E293B',         // Slate 800
    light: '#F8FAFC',        // Slate 50
    muted: '#64748B',        // Slate 500
    border: '#E2E8F0',       // Slate 200
};

// Typography
const TEXT_STYLES = {
    title: { weight: 'bold', size: 'xl', color: '#1E293B' },
    subtitle: { weight: 'bold', size: 'md', color: '#334155' },
    body: { size: 'sm', color: '#475569', wrap: true },
    caption: { size: 'xs', color: '#94A3B8' },
    badge: { size: 'xxs', color: '#ffffff', weight: 'bold' },
};

interface FlexMessageOptions {
    type: 'repair_new' | 'repair_complete' | 'photography_new' | 'status_card';
    title: string;
    subtitle?: string;
    description?: string;
    imageUrl?: string;
    badge?: string;
    badgeColor?: string;
    details?: Array<{ icon: string; label: string; value: string }>;
    footer?: {
        label: string;
        uri: string;
        color?: string;
    };
    status?: {
        text: string;
        color: string;
    };
}

/**
 * Create a professional Flex Message bubble
 */
export function createFlexBubble(options: FlexMessageOptions) {
    const {
        type,
        title,
        subtitle,
        description,
        imageUrl,
        badge,
        badgeColor = COLORS.primary,
        details = [],
        footer,
        status
    } = options;

    // Configure theme based on type
    const themes: Record<string, { headerBg: string; accentColor: string; icon: string }> = {
        repair_new: { headerBg: COLORS.info, accentColor: COLORS.info, icon: '🔧' },
        repair_complete: { headerBg: COLORS.success, accentColor: COLORS.success, icon: '✅' },
        photography_new: { headerBg: COLORS.warning, accentColor: COLORS.warning, icon: '📸' },
        status_card: { headerBg: status?.color || COLORS.primary, accentColor: status?.color || COLORS.primary, icon: '📋' },
    };

    const theme = themes[type] || themes.status_card;

    const bubble: any = {
        type: 'bubble',
        size: 'mega',
    };

    // Hero Section (Image with overlay badge)
    if (imageUrl) {
        bubble.hero = {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'image',
                    url: imageUrl,
                    size: 'full',
                    aspectRatio: '20:13',
                    aspectMode: 'cover',
                },
                // Gradient overlay at bottom
                {
                    type: 'box',
                    layout: 'vertical',
                    contents: [],
                    position: 'absolute',
                    offsetBottom: '0px',
                    offsetStart: '0px',
                    offsetEnd: '0px',
                    height: '80px',
                    background: {
                        type: 'linearGradient',
                        angle: '0deg',
                        startColor: '#00000099',
                        endColor: '#00000000'
                    }
                },
                // Badge in corner (pill style)
                ...(badge ? [{
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: badge,
                            size: 'xxs',
                            color: '#ffffff',
                            weight: 'bold'
                        }
                    ],
                    position: 'absolute',
                    offsetTop: '12px',
                    offsetStart: '12px',
                    backgroundColor: badgeColor,
                    cornerRadius: '20px',
                    paddingTop: '4px',
                    paddingBottom: '4px',
                    paddingStart: '12px',
                    paddingEnd: '12px'
                }] : [])
            ],
            paddingAll: '0px'
        };
    } else {
        // Header without image
        bubble.header = {
            type: 'box',
            layout: 'vertical',
            backgroundColor: theme.headerBg,
            paddingAll: '20px',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: badge || type.toUpperCase().replace('_', ' '),
                            color: '#ffffffcc',
                            weight: 'bold',
                            size: 'xxs'
                        },
                        {
                            type: 'text',
                            text: theme.icon,
                            align: 'end'
                        }
                    ]
                },
                {
                    type: 'text',
                    text: title,
                    weight: 'bold',
                    size: 'xl',
                    color: '#ffffff',
                    margin: 'md',
                    wrap: true
                },
                ...(subtitle ? [{
                    type: 'text',
                    text: subtitle,
                    size: 'xs',
                    color: '#ffffffaa',
                    margin: 'xs'
                }] : [])
            ]
        };
    }

    // Body Section
    const bodyContents: any[] = [];

    // Title (if hero image exists, title goes in body)
    if (imageUrl) {
        bodyContents.push({
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'lg',
            color: COLORS.dark,
            wrap: true
        });

        if (subtitle) {
            bodyContents.push({
                type: 'text',
                text: subtitle,
                size: 'sm',
                color: COLORS.muted,
                margin: 'sm'
            });
        }

        bodyContents.push({
            type: 'separator',
            margin: 'lg',
            color: COLORS.border
        });
    }

    // Details rows
    if (details.length > 0) {
        bodyContents.push({
            type: 'box',
            layout: 'vertical',
            margin: imageUrl ? 'lg' : 'none',
            spacing: 'md',
            contents: details.map(detail => ({
                type: 'box',
                layout: 'horizontal',
                spacing: 'md',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        width: '24px',
                        contents: [
                            { type: 'text', text: detail.icon, size: 'sm', align: 'center' }
                        ]
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        flex: 1,
                        contents: [
                            { type: 'text', text: detail.label, size: 'xs', color: COLORS.muted },
                            { type: 'text', text: detail.value, size: 'sm', color: COLORS.dark, wrap: true, margin: 'xs' }
                        ]
                    }
                ]
            }))
        });
    }

    // Description box
    if (description) {
        bodyContents.push({
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            paddingAll: '14px',
            backgroundColor: '#F1F5F9',
            cornerRadius: '12px',
            contents: [
                { type: 'text', text: '📝 รายละเอียด', size: 'xs', color: COLORS.muted, weight: 'bold' },
                { type: 'text', text: description, size: 'sm', color: COLORS.dark, wrap: true, margin: 'sm' }
            ]
        });
    }

    bubble.body = {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        backgroundColor: '#ffffff',
        contents: bodyContents
    };

    // Footer with button
    if (footer) {
        bubble.footer = {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    height: 'md',
                    color: footer.color || theme.accentColor,
                    action: {
                        type: 'uri',
                        label: footer.label,
                        uri: footer.uri
                    }
                }
            ]
        };
    }

    return bubble;
}

/**
 * Create a Flex Message for new repair requests
 */
export function createRepairNewFlexMessage(data: {
    description: string;
    room: string;
    requesterName: string;
    imageUrl?: string;
    ticketId?: string;
    deepLink: string;
}) {
    return {
        type: 'flex',
        altText: `🔧 งานซ่อมใหม่: ${data.room}`,
        contents: createFlexBubble({
            type: 'repair_new',
            title: data.description,
            badge: '🔧 งานซ่อมใหม่',
            badgeColor: COLORS.info,
            imageUrl: data.imageUrl,
            details: [
                { icon: '📍', label: 'สถานที่', value: data.room },
                { icon: '👤', label: 'ผู้แจ้ง', value: data.requesterName },
                { icon: '🕐', label: 'เวลาแจ้ง', value: new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) }
            ],
            footer: {
                label: '📋 รับงานซ่อม',
                uri: data.deepLink,
                color: COLORS.info
            }
        })
    };
}

/**
 * Create a Flex Message for repair completion
 */
export function createRepairCompleteFlexMessage(data: {
    problem: string;
    room: string;
    technicianNote?: string;
    completionImage?: string;
    historyLink: string;
}) {
    return {
        type: 'flex',
        altText: `✅ งานซ่อมเสร็จสิ้น: ${data.problem}`,
        contents: createFlexBubble({
            type: 'repair_complete',
            title: data.problem,
            subtitle: 'ขอบคุณที่ใช้บริการ',
            badge: '✅ เสร็จสิ้น',
            badgeColor: COLORS.success,
            imageUrl: data.completionImage,
            details: [
                { icon: '📍', label: 'สถานที่', value: data.room },
                { icon: '📅', label: 'วันที่', value: new Date().toLocaleDateString('th-TH') },
                ...(data.technicianNote ? [{ icon: '📝', label: 'บันทึกช่าง', value: data.technicianNote }] : [])
            ],
            footer: {
                label: '📜 ดูประวัติการซ่อม',
                uri: data.historyLink,
                color: COLORS.success
            }
        })
    };
}

/**
 * Create a Flex Message for photography job assignment
 */
export function createPhotographyFlexMessage(data: {
    title: string;
    location: string;
    date: string;
    startTime: string;
    endTime: string;
    teamMembers: string[];
    description?: string;
    appUrl: string;
}) {
    return {
        type: 'flex',
        altText: `📸 งานถ่ายภาพ: ${data.title}`,
        contents: createFlexBubble({
            type: 'photography_new',
            title: data.title,
            subtitle: 'คุณได้รับมอบหมายงานถ่ายภาพ',
            badge: '📸 งานใหม่',
            badgeColor: COLORS.warning,
            description: data.description,
            details: [
                { icon: '📍', label: 'สถานที่', value: data.location },
                { icon: '📅', label: 'วันที่', value: data.date },
                { icon: '⏰', label: 'เวลา', value: `${data.startTime} - ${data.endTime}` },
                { icon: '👥', label: 'ทีมงาน', value: data.teamMembers.join(', ') }
            ],
            footer: {
                label: '📱 เปิดดูในระบบ',
                uri: data.appUrl,
                color: COLORS.warning
            }
        })
    };
}

/**
 * Create a status tracking bubble for carousel
 */
export function createStatusBubble(data: {
    id: string;
    description: string;
    room: string;
    status: string;
    statusColor: string;
    statusText: string;
    createdAt: string;
    imageUrl?: string;
    technicianNote?: string;
    historyLink: string;
}) {
    return createFlexBubble({
        type: 'status_card',
        title: data.description,
        badge: data.statusText,
        badgeColor: data.statusColor,
        imageUrl: data.imageUrl,
        status: { text: data.statusText, color: data.statusColor },
        details: [
            { icon: '📍', label: 'สถานที่', value: data.room },
            { icon: '📅', label: 'วันที่แจ้ง', value: data.createdAt },
            ...(data.technicianNote ? [{ icon: '💬', label: 'บันทึกช่าง', value: data.technicianNote }] : [])
        ],
        footer: {
            label: 'ดูรายละเอียด',
            uri: data.historyLink,
            color: data.statusColor
        }
    });
}

export { COLORS };
