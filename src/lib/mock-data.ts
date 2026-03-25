import {
  BlacklistEntry,
  ChannelConfig,
  MessageThread,
  PlatformMessage,
  Project,
  ProjectChatThread,
} from "@/types/domain";

export const mockProjects: Project[] = [
  {
    id: "prj-001",
    code: "DA-001",
    name: "De An Sunview Tower",
    ownerName: "Nguyen Van A",
    status: "active",
    lastUpdateAt: "2026-03-20 09:30",
    unreadCount: 4,
    summary:
      "Khach hang quan tam block B, can chot lich gap vao dau tuan sau. Da gui bao gia dot 2.",
    todoList: [
      "Xac nhan lich hop vao thu 2",
      "Gui them 2 phuong an thanh toan",
      "Theo doi phan hoi qua Zalo",
    ],
  },
  {
    id: "prj-002",
    code: "DA-002",
    name: "Biet Thu River Park",
    ownerName: "Tran Thi B",
    status: "urgent",
    lastUpdateAt: "2026-03-20 08:10",
    unreadCount: 9,
    summary:
      "Khach hang doi deal gia truoc 17:00 hom nay. Can uu tien xu ly de tranh mat lead.",
    todoList: [
      "Goi dien xac nhan nhu cau trong 30 phut",
      "Cap nhat bang gia uu dai",
      "Ping quan ly xin approve gia",
    ],
  },
  {
    id: "prj-003",
    code: "DA-003",
    name: "Can Ho Metro Line",
    ownerName: "Le Van C",
    status: "new",
    lastUpdateAt: "2026-03-19 16:40",
    unreadCount: 1,
    summary:
      "Lead moi tu email campaign, da hoi thong tin can ho 2PN va tien do thanh toan.",
    todoList: ["Gui brochure co ban", "Hen call tu van 15 phut"],
  },
];

export const mockChannelConfigs: ChannelConfig[] = [
  {
    id: 1,
    user_id: 42,
    provider: "email",
    status: "active",
    auth_config: {
      server: "192.168.117.200:143",
      use_tls: false,
    },
    created_at: "2026-03-21 10:20:00",
  },
  {
    id: 2,
    user_id: 42,
    provider: "email",
    status: "inactive",
    auth_config: {
      server: "mail.backup.local:993",
      use_tls: true,
    },
    created_at: "2026-03-20 09:10:00",
  },
];

export const mockThreads: MessageThread[] = [
  {
    id: "thread-001",
    channel: "email",
    title: "Re: Bao gia DA-001",
    participants: ["khach1@gmail.com", "sales.team@company.com"],
    projectIds: ["prj-001"],
    latestMessage: "Toi muon xem them phuong an thanh toan theo tien do.",
    updatedAt: "10:15",
  },
  {
    id: "thread-002",
    channel: "zalo",
    title: "Cum tin nhan khach Tran Thi B",
    participants: ["Tran Thi B", "Sale Sang"],
    projectIds: [],
    latestMessage: "Gia nay co fix them duoc nua khong?",
    updatedAt: "09:52",
  },
  {
    id: "thread-003",
    channel: "whatsapp",
    title: "Khach quan tam DA-003",
    participants: ["+84 912 000 111", "Sale Sang"],
    projectIds: ["prj-003"],
    latestMessage: "Cho minh xin video nha mau.",
    updatedAt: "Hqua",
  },
];

export const mockProjectChats: ProjectChatThread[] = [
  {
    projectId: "prj-001",
    projectName: "De An Sunview Tower",
    messages: [
      {
        id: "msg-001",
        role: "agent",
        content:
          "Da tong hop thread moi: khach quan tam tien do thanh toan. Ban nen gui 2 option tra gop trong hom nay.",
        createdAt: "09:40",
      },
      {
        id: "msg-002",
        role: "sale",
        content: "Ok, toi can 1 draft tin nhan gui qua Zalo ngay bay gio.",
        createdAt: "09:42",
      },
    ],
  },
  {
    projectId: "prj-002",
    projectName: "Biet Thu River Park",
    messages: [
      {
        id: "msg-003",
        role: "agent",
        content:
          "Project dang o muc urgent. Deadline 17:00, uu tien xu ly de xac nhan deal gia.",
        createdAt: "08:12",
      },
    ],
  },
  {
    projectId: "prj-003",
    projectName: "Can Ho Metro Line",
    messages: [
      {
        id: "msg-004",
        role: "agent",
        content:
          "Lead moi tu email campaign. Goi y gui brochure 2PN va hen lich call 15 phut.",
        createdAt: "16:55",
      },
    ],
  },
];

export const mockPlatformMessages: PlatformMessage[] = [
  {
    id: "msg-platform-001",
    conversationId: "conv-zalo-001",
    channel: "zalo",
    senderId: "zalo:0901112233",
    senderDisplay: "Le Thi Hoa",
    subject: "Hoi thong tin project DA-001",
    snippet: "Anh/chị gui giup em bang gia block B",
    content:
      "Xin chao team, em dang quan tam can 2PN block B. Nho gui bang gia moi nhat va uu dai thanh toan.",
    receivedAt: "2026-03-20 10:42",
    projectIds: ["prj-001"],
  },
  {
    id: "msg-platform-002",
    conversationId: "conv-wa-001",
    channel: "whatsapp",
    senderId: "wa:+84912000111",
    senderDisplay: "+84 912 000 111",
    subject: "Video nha mau",
    snippet: "Can video va brochure ban 2PN",
    content:
      "Hi team, please send me latest showroom video and brochure for the 2-bedroom unit.",
    receivedAt: "2026-03-20 09:15",
    projectIds: ["prj-003"],
  },
  {
    id: "msg-platform-003",
    conversationId: "conv-email-001",
    channel: "email",
    senderId: "email:khach.vip@gmail.com",
    senderDisplay: "khach.vip@gmail.com",
    subject: "[DA-002] Xin muc gia tot nhat",
    snippet: "Can cot duoc gia truoc 17:00 hom nay",
    content:
      "Chao team sales, vui long cho toi muc gia tot nhat de chot trong ngay hom nay. Cam on.",
    receivedAt: "2026-03-20 08:53",
    projectIds: ["prj-002"],
  },
  {
    id: "msg-platform-004",
    conversationId: "conv-email-spam-001",
    channel: "email",
    senderId: "email:spam.sender@foo.com",
    senderDisplay: "spam.sender@foo.com",
    subject: "Moi hop tac data base",
    snippet: "Gia re bat ngo",
    content:
      "Mời hợp tác mua data khách hàng. Liên hệ ngay để nhận ưu đãi.",
    receivedAt: "2026-03-19 21:14",
    projectIds: [],
  },
];

export const mockBlacklistEntries: BlacklistEntry[] = [
  {
    id: "bl-001",
    channel: "email",
    senderId: "email:spam.sender@foo.com",
    senderDisplay: "spam.sender@foo.com",
    reason: "Spam quang cao lap lai",
    createdAt: "2026-03-19 21:20",
  },
];
