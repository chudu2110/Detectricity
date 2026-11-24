# Chạy Detectricity trên Samsung qua USB

Workspace chính: `/home/ai_team/vu/Detectricity/Detectricity` trên máy Linux 192.168.30.28. VS Code Remote mở workspace này; điện thoại Samsung SM-M325FV dùng development build `com.dafoggo.wattprint.dev`. Mã sản phẩm, API và Metro đều chạy từ checkout này.

## Sau khi khởi động lại

1. Trên Linux, vào `wattprint-backend` và chạy `docker compose up -d db keycloak-db keycloak api mailpit`. Project Compose của checkout này dùng tên `detectricity-vu` và database riêng. Kiểm tra bằng `docker compose ps`; migration chạy khi API khởi động.
2. Trong VS Code Remote, chuyển tiếp các cổng Linux `12093` (API), `12095` (Keycloak), `12094` (Metro) tới cùng số cổng trên laptop.
3. Trên Linux, vào `wattprint-expo` và giữ terminal chạy `pnpm exec expo start --port 12094 --localhost --dev-client`. Sau khi cài dependencies hoặc đổi native module, cần build lại development app; sửa JavaScript thông thường chỉ cần Metro.
4. Cắm và mở khóa điện thoại; chấp nhận USB debugging. Trên laptop kiểm tra `adb devices`, rồi chạy `adb reverse tcp:12093 tcp:12093`, `adb reverse tcp:12095 tcp:12095`, `adb reverse tcp:12094 tcp:12094`. Nếu cắm nhiều máy, thêm `-s RF8T40H2DSF` ngay sau `adb`.
5. Mở app Detectricity. Nếu app chưa nối lại Metro, dùng deep link:

```powershell
adb -s RF8T40H2DSF shell "am start -p com.dafoggo.wattprint.dev -a android.intent.action.VIEW -d 'wattprint://?__expo_url=http%3A%2F%2Flocalhost%3A12094&__expo_disable_onboarding=1&__expo_disable_fab=1&__expo_disable_auto_launch=1'"
```

Trên Windows, nếu không dùng alias `adb`, chạy `D:\platform-tools-latest-windows\platform-tools\adb.exe`. Nếu VS Code chọn local port khác, đổi về `12093`, `12094`, `12095` trước khi chạy `adb reverse`.

## Dữ liệu và tài khoản

- Dữ liệu REFIT House 2 là bản ghi tĩnh để demo, dừng ở 20/11/2026; chỉ số hôm nay có thể bằng 0. Đây không phải số điện của nhà người dùng.
- Google sign-in đã được thử trên Samsung. OAuth Client ID/Secret và OpenAI key chỉ ở backend `.env`; không sao chép vào Git hoặc biến `EXPO_PUBLIC_*`.
- Smart plug trong màn Thêm nguồn dữ liệu hiện là mô phỏng từ REFIT. Trạng thái online/offline cũng là demo. Tên plug được lưu trong database riêng, còn số kWh REFIT nằm ở mục con dữ liệu gốc để tránh tính hai lần.
- Có thể nhập CSV và ghi chỉ số công tơ ở màn Thêm nguồn dữ liệu. Các nguồn này chưa thay đổi số liệu của dashboard REFIT.
- Giọng nói AstralX được hoãn theo yêu cầu.

## Kiểm tra nhanh

Mở tab Thiết bị → Thêm nguồn dữ liệu hoặc chạm nhóm Dishwasher để xem các mục con. Nếu API báo lỗi, kiểm tra `docker compose logs --tail=60 api` trên Linux. Nếu app không tải mã mới, kiểm tra terminal Metro, cổng 12094 và `adb reverse --list`.
