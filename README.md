# Detectricity

Trợ lý AI điện năng cho hộ gia đình Việt Nam. Repo này tập hợp mã nguồn frontend,
backend và các cập nhật đang phát triển trên máy tại thời điểm 22/11/2026.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `wattprint-expo` | Ứng dụng React Native / Expo, giao diện Detectricity |
| `wattprint-backend` | FastAPI, PostgreSQL / TimescaleDB, Keycloak, AI và pipeline dữ liệu |
| `Agent-Rules` | Hướng dẫn workspace, mô tả sản phẩm và checklist phát triển |

Hai thư mục mã nguồn được lưu trực tiếp trong repo, không phải submodule. Tên
thư mục và application ID giữ tương thích với bản development đang dùng.

## Cài đặt

1. Đọc [hướng dẫn workspace](Agent-Rules/README.md), rồi README và AGENTS.md của
   phần dự án cần chạy.
2. Tạo `.env` riêng từ `.env.example` trong từng thư mục. Điền credentials bằng
   kênh riêng; repo không chứa `.env`, token hoặc tài khoản của máy phát triển.
3. Backend cần Python và dependencies theo `wattprint-backend/pyproject.toml`.
   Hạ tầng Docker và quy trình migrate/seed được mô tả trong
   [README backend](wattprint-backend/README.md).
4. Frontend dùng Node và pnpm theo `wattprint-expo/package.json`. Chạy `pnpm install`
   trong `wattprint-expo`, rồi làm theo [README frontend](wattprint-expo/README.md)
   để tạo Android development build. Không dùng Expo Go.

Các cổng phát triển: FastAPI `11093`, Metro `11094`, Keycloak `11095`, database
`11096`. Không cần mang `node_modules`, `.venv`, native build hoặc cache từ máy cũ.

## Dữ liệu demo

Demo phát lại bản ghi công khai REFIT House 2, không phải số đo tại nhà người dùng.
Các archive dữ liệu và training đã có trong backend được giữ lại. Bundle mô hình
House 2 đang dùng cũng có tại `wattprint-backend/dataset/models/nilm/house2`.
File CSV thô và dữ liệu giải nén lớn không được lưu thêm lần nữa; đọc hướng dẫn
backend để giải nén, seed và chạy replay. Database hiện tại trên máy không được
đưa lên Git; clone repo cần tạo database và seed theo hướng dẫn.

Google OAuth, chat, speech và các dịch vụ bên ngoài cần cấu hình riêng. Backend
JWT validation vẫn được giữ; endpoint demo chỉ dùng cho môi trường local theo
hướng dẫn backend.

## Kiểm tra

- Frontend: `pnpm check`, `pnpm format:check`, `npx expo-doctor`.
- Backend: chạy `pytest` trong môi trường đã cài dependencies và có database test.
- Với thay đổi UI/native, kiểm tra trên điện thoại thật theo AGENTS.md.

File checklist ngắn nằm trong `Agent-Rules/deliverables/Detectricity_Checklist_Ngan_gon.docx`.
Log, ảnh chụp runtime và các file cấu hình riêng của máy không được xuất bản.

### Kết quả kiểm tra trước khi đưa lên repo

Ngày 22/11/2026: frontend qua ESLint, TypeScript, Prettier và 73 bộ Jest với
579 test. Các công cụ được chạy trực tiếp từ dependencies cục bộ vì launcher pnpm
trên máy đang lỗi. Expo Doctor còn 1 kiểm tra chưa đạt do 14 dependency lệch
phiên bản SDK; chưa tự nâng dependency trong lần đưa mã nguồn lên Git này.
Full suite backend có các kiểm thử database chạy lâu và chưa hoàn tất trong lần
kiểm tra này; không coi bản snapshot này là một bản phát hành đã nghiệm thu.
Hai bộ kiểm thử backend liên quan đến đăng nhập demo và LLM mới đã qua cả 8 test.
