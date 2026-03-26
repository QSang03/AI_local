# OpenClaw Frontend Workspace

Frontend cho luong sale workflow:

- Config channel (Mail/Zalo/WhatsApp)
- Marking message vao project
- Dashboard project + summary/todolist
- Chat voi AI agent theo tung project

Luu y:

- Man chat voi agent chua bat trong phase hien tai
- FE co che do mock de dev song song backend

## Local Development

1. Cai package:

	npm install

2. Tao file env (copy tu .env.example) va chinh theo nhu cau.

3. Chay dev server:

	npm run dev

4. Truy cap:

	http://localhost:3000

## Environment Variables

- NEXT_PUBLIC_API_BASE_URL
  - Base URL cua backend (vi du: http://localhost:8080/api)
- NEXT_PUBLIC_USE_MOCK
  - true: dung mock data
  - false: goi backend that, neu loi se fallback mock cho GET
- NEXT_PUBLIC_CHAT_BRIDGE_WS_URL
	- WebSocket URL cho chat-bridge (vi du: ws://localhost:3001/ws)
- NEXT_PUBLIC_CHAT_WS_URL
	- WebSocket URL ket noi truc tiep backend chat (vi du: ws://192.168.117.64:8080/api/chat/ws)
- NEXT_PUBLIC_SALE_ID
	- Session ID cua sale tren openclaw bridge (vi du: sale_sang)
- NEXT_PUBLIC_SALE_NAME
	- Ten hien thi tren chat bridge

## Scripts

- npm run dev
- npm run lint
- npm run build
- npm run start

## Main Routes

- /login
- /projects
- /channels
- /marking
- /chat

## Current FE Scope

- Responsive layout cho desktop/mobile
- Loading skeleton va app-level error boundary
- Validation co ban cho channel config
- Multi-select + drag-drop cho marking
- Chat UI local mode (mock), gui nhan tin va auto-reply agent

## Chat Bridge Integration

FE chat da ho tro 2 che do:

- Bridge mode: neu co NEXT_PUBLIC_CHAT_BRIDGE_WS_URL
- Local mode: fallback mock neu khong co bridge hoac bridge mat ket noi

Flow bridge mode:

1. FE mo WebSocket den chat-bridge
2. FE gui message voi type=chat
3. FE nhan stream token tu bridge va render realtime
4. FE nhan done de ket thuc luot tra loi
