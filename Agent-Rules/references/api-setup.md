# Hướng dẫn chuẩn bị API và cấu hình cho Wattprint

Cập nhật: 21/11/2026. Đối chiếu với hai repo đã clone trong `D:\Pinnovation2`.

## 1. Bạn cần chuẩn bị những gì?

| Mục | Dùng để làm gì? | Cần chuẩn bị cho bản đầy đủ |
| --- | --- | --- |
| Google OAuth: Client ID + Client Secret | Đăng nhập Google thông qua Keycloak | Có |
| OpenRouter API key | Wappi trả lời bằng mô hình ngôn ngữ | Có |
| OpenWeather API key | Thời tiết hiện tại và dự báo | Có, quyền gọi cả weather và forecast |
| AstralX API key | Nhận dạng giọng nói và đọc câu trả lời | Có, quyền dùng cả STT và TTS |
| Text2SQL: URL + connection ID + service key | Cho Wappi hỏi dữ liệu linh hoạt bằng SQL | Cần một dịch vụ riêng, xem mục 6 |
| Mật khẩu database, Keycloak, tài khoản demo | Chạy hạ tầng local | Tôi có thể tạo khi triển khai; bạn không phải đăng ký API |
| Mô hình và dữ liệu NILM | Ước lượng điện năng từng thiết bị từ công tơ tổng | Không cần API key; cần kiểm tra/chuẩn bị file mô hình |

**Mục tiêu: triển khai toàn bộ cùng một đợt.** Chuẩn bị đủ Google OAuth, OpenRouter, OpenWeather,
AstralX và thông tin dịch vụ Text2SQL theo các mục 3–7. Tôi sẽ xử lý hạ tầng, dữ liệu, mô hình NILM
và tích hợp FE/BE/AI. Có key chưa đồng nghĩa app đã được tích hợp.

## 2. Điền các giá trị vào đâu?

File cấu hình bí mật của backend:

```text
D:\Pinnovation2\wattprint-backend\.env
```

Nếu chưa có file, chạy trong PowerShell:

```powershell
Set-Location D:\Pinnovation2\wattprint-backend
if (!(Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
notepad .env
```

Điền giá trị ở các dòng tương ứng, giữ mỗi biến trên một dòng. Đừng ghi đè cả file nếu đã có cấu hình.
Không đặt khóa bí mật vào file này (`instruct.md`) hoặc các biến `EXPO_PUBLIC_*` của FE:
những biến public có thể nằm trong bundle app. Backend đã git-ignore `.env`.

Sau khi điền xong, chỉ cần nhắn: **“Đã điền .env ở D:\Pinnovation2\wattprint-backend\.env, triển khai tiếp.”**
Tôi có thể đọc trực tiếp trên máy; bạn không cần dán khóa bí mật vào chat.

## 3. Google OAuth — đăng nhập Google

### Các bước lấy

1. Mở [Google Cloud Console](https://console.cloud.google.com/), đăng nhập tài khoản bạn quản lý.
2. Tạo project, ví dụ `Wattprint Demo`, hoặc chọn một project phù hợp đã có.
3. Mở **Google Auth Platform**. Nếu chưa cấu hình, chọn **Get started**.
4. Điền tên ứng dụng `Wattprint Demo`, email hỗ trợ và email liên hệ.
5. Ở phần **Audience**, chọn **External** nếu dùng Gmail cá nhân. Nếu project ở chế độ Testing,
   thêm các địa chỉ Google sẽ dùng thử vào **Test users** khi giao diện cho phép/yêu cầu.
6. Vào **Clients → Create client**. Chọn loại **Web application** vì Google trả kết quả về Keycloak.
7. Đặt tên client, ví dụ `Wattprint Keycloak Local`.
8. Trong **Authorized redirect URIs**, thêm chính xác:

   ```text
   http://localhost:11095/realms/wattprint/broker/google/endpoint
   ```

9. Tạo client. Lưu **Client ID** và **Client Secret**; có thể tải JSON credentials nếu Google cung cấp.
10. Điền vào `.env` backend:

    ```dotenv
    GOOGLE_CLIENT_ID=DIEN_CLIENT_ID_CUA_BAN
    GOOGLE_CLIENT_SECRET=DIEN_CLIENT_SECRET_CUA_BAN
    ```

### Các điểm cần đúng

- Luồng hiện tại là App → Keycloak → Google → Keycloak → App. Client Google ở đây là Web application;
  client mobile `wattprint-mobile` được cấu hình riêng bên Keycloak.
- `wattprint://auth` là callback từ Keycloak về app; không dùng nó thay URI Google ở bước 8.
- Hướng dẫn này dùng localhost và adb reverse cho Android. Nếu chuyển sang server/domain,
  tôi sẽ cung cấp callback mới để bạn bổ sung trong Google Console.
- Lỗi `redirect_uri_mismatch` thường cần kiểm tra URI thực tế khớp tuyệt đối với URI đã đăng ký.
- Repo nhập thông tin Google khi khởi tạo realm lần đầu. Nếu thay `.env` sau khi realm đã tồn tại,
  tôi cần cập nhật Google Identity Provider trong Keycloak; chỉ restart có thể chưa đủ.

Nguồn: [Google Auth Platform](https://support.google.com/cloud/answer/15544987?hl=en),
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
Callback và tên biến được đối chiếu với `wattprint-backend/keycloak/realm/wattprint-realm.json`.

## 4. OpenRouter — chatbot Wappi

### Các bước lấy

1. Mở [OpenRouter](https://openrouter.ai/), tạo tài khoản hoặc đăng nhập.
2. Vào [API Keys](https://openrouter.ai/settings/keys), chọn **Create Key**.
3. Đặt tên, ví dụ `wattprint-local-demo`; đặt giới hạn chi tiêu phù hợp nếu giao diện hỗ trợ.
4. Sao chép key và lưu trực tiếp vào `.env`:

   ```dotenv
   OPENROUTER_API_KEY=DIEN_OPENROUTER_KEY_CUA_BAN
   ```

5. Mở [Models](https://openrouter.ai/models). Nếu bạn muốn tự chọn model, tìm model hỗ trợ
   **tool calling/tools** và streaming, rồi sao chép đúng model ID dạng `nha-cung-cap/ten-model`.
6. Điền model ID vào:

   ```dotenv
   OPENROUTER_MODEL=DIEN_MODEL_ID_DA_CHON
   ```

   Nếu chưa biết chọn model nào, để nguyên dòng model hiện tại và nhắn “nhờ chọn model”.
   Tôi sẽ kiểm tra model khả dụng và sửa cấu hình trước khi chạy.
7. Kiểm tra [Credits](https://openrouter.ai/settings/credits). Model trả phí cần số dư phù hợp;
   nếu dùng model miễn phí, vẫn cần kiểm tra hạn mức và khả năng tool calling của model đó.

### Các điểm cần đúng

- Backend hiện trỏ tới `https://openrouter.ai/api/v1` và dùng Bearer key của OpenRouter.
- Một key OpenAI hoặc một gói thuê bao chatbot không tự thay được key OpenRouter trong cấu hình này.
- Repo đang mặc định `OPENROUTER_MODEL=openai/gpt-6-luna`. Đây chỉ là giá trị trong mã nguồn;
  chưa xác nhận model ID đó có thể dùng với tài khoản của bạn. Không dựa vào mặc định để mua dịch vụ.
- Còn có `COPILOT_GUARD_MODEL` để sàng lọc nội dung. Tôi sẽ kiểm tra model này cùng model chính;
  bạn không cần lấy key thứ hai cho nó. Khi chạy Docker, tôi cũng sẽ kiểm tra việc truyền biến này vào container.
- Wappi cần dữ liệu căn nhà và phiên đăng nhập, ngoài key LLM. Có key nhưng database trống thì
  chưa thể trả lời chính xác câu hỏi về điện nhà bạn.

Nguồn: [OpenRouter authentication và API keys](https://openrouter.ai/docs/api_reference/authentication).
Tên biến và cách dùng được đối chiếu với `app/config.py` và `app/modules/copilot/services/llm.py` trong backend.

## 5. OpenWeather — thời tiết

1. Đăng ký/đăng nhập từ [OpenWeather](https://openweathermap.org/appid).
2. Mở trang [API keys](https://home.openweathermap.org/api_keys).
3. Sao chép key đang có hoặc tạo key riêng tên `Wattprint Demo`.
4. Điền vào `.env` backend:

   ```dotenv
   OPENWEATHER_API_KEY=DIEN_OPENWEATHER_KEY_CUA_BAN
   ```

5. Kiểm tra quyền truy cập của tài khoản cho hai API mà mã nguồn hiện dùng:
   - Current Weather: `https://api.openweathermap.org/data/2.5/weather`
   - 5 day / 3 hour forecast: `https://api.openweathermap.org/data/2.5/forecast`
6. Nếu key mới chưa hoạt động, kiểm tra trạng thái kích hoạt trong tài khoản/hướng dẫn nhà cung cấp.

Backend lấy các mốc dự báo 3 giờ để hiển thị 24 giờ tiếp theo; hiện không gọi One Call 3.0/4.0.
Chưa cần đăng ký One Call riêng chỉ để đáp ứng mã nguồn này. Kiểm tra gói và chi phí hiện tại trước khi đăng ký.
Tôi còn cần cấu hình tỉnh/vị trí căn nhà để backend lấy đúng tọa độ.

Nguồn: [Bắt đầu với OpenWeather](https://openweathermap.org/appid).
Endpoint được xác nhận trực tiếp từ `app/modules/energy/services/weather.py`.

## 6. Text2SQL — dịch vụ riêng, chưa cần bạn mua key

Backend nhắc tới dịch vụ `wattprint-text2sql-mcp`, nhưng dịch vụ đó không nằm trong hai repo đã clone.
Nó giúp Wappi chuyển câu hỏi dữ liệu tự do thành truy vấn trong phạm vi căn nhà của người dùng.

Các biến liên quan:

```dotenv
TEXT2SQL_URL=http://host.docker.internal:11101
TEXT2SQL_CONNECTION_ID=
TEXT2SQL_SERVICE_KEY=
```

Đây không phải ba giá trị đăng ký ở OpenRouter hoặc Google:

1. Nếu bạn có repo `wattprint-text2sql-mcp`, gửi link repo hoặc đường dẫn bản có sẵn.
2. Tôi sẽ đọc hướng dẫn của repo đó, triển khai service và cấu hình kết nối database Wattprint.
3. `TEXT2SQL_CONNECTION_ID` lấy từ kết nối được đăng ký trong service đã triển khai.
4. `TEXT2SQL_SERVICE_KEY` là khóa chung giữa backend và service; có thể tạo khi triển khai,
   rồi cấu hình khớp ở cả hai phía. Backend gửi nó qua header `X-Service-Key`.
5. `TEXT2SQL_URL` phải là địa chỉ backend thực sự truy cập được. URL mặc định ở trên dành cho
   backend trong Docker gọi một dịch vụ trên máy host; không dùng máy móc cho mọi cách chạy.

Nếu chưa có dịch vụ này, báo “chưa có Text2SQL” để tôi xác định cách triển khai trong cùng đợt.
Để nghiệm thu đủ phần hỏi SQL tự do, phải có dịch vụ hoạt động cùng ba giá trị trên;
chỉ có key OpenRouter là chưa đủ. Bạn không cần tìm một API key Text2SQL bất kỳ trên mạng.

## 7. AstralX — giọng nói

Backend hiện dùng:

```text
Base URL: https://token.astralx.com.vn/v1
Nhận giọng nói: POST /audio/transcriptions
Đọc câu trả lời: POST /audio/speech
```

1. Truy cập [AstralX Token](https://token.astralx.com.vn/).
2. Nếu có cổng đăng ký/đăng nhập, dùng tài khoản của bạn và tìm khu vực quản lý API token/key.
3. Nếu không có chức năng tự cấp key, liên hệ bên cung cấp AstralX hoặc chủ repo để xin tài khoản/API token.
4. Yêu cầu quyền dùng cả speech-to-text và text-to-speech với API tương thích hai endpoint trên.
5. Điền key được cấp vào `.env`:

   ```dotenv
   ASTRALX_API_KEY=DIEN_ASTRALX_KEY_CUA_BAN
   ```

Các giá trị mặc định trong mã nguồn là STT `whisper-large-v3-turbo`, TTS `astralx-tts`, voice `speaker_05`.
Nhờ nhà cung cấp xác nhận quyền truy cập và tên model/voice, nếu cần tôi sẽ điều chỉnh cấu hình.

**Giới hạn xác minh:** chưa truy cập được cổng AstralX bằng công cụ duyệt web, nên chưa thể xác nhận
tên menu hay quy trình tự cấp token. Các endpoint/model ở trên lấy từ backend, không phải cam kết
khả dụng của nhà cung cấp. Nếu không lấy được token, báo lại ngay để xác định nhà cung cấp thay thế
và điều chỉnh adapter trong cùng đợt triển khai, thay vì bỏ phần giọng nói.

## 8. Những phần tôi sẽ chuẩn bị khi triển khai

Bạn không phải lấy API key bên ngoài cho các mục dưới đây:

- **PostgreSQL/TimescaleDB, Keycloak:** dựng bằng Docker và tạo mật khẩu local riêng.
- **Các biến bí mật nội bộ:** `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_DB_PASSWORD`,
  `WATTPRINT_ADMIN_PASSWORD`, `WATTPRINT_WEB_CLIENT_SECRET`, `DEMO_PASSWORD` và các mật khẩu DB role
  khi cần. Không dùng nguyên `change-me` của file mẫu.
- **Dữ liệu demo:** chuẩn bị dữ liệu REFIT, chạy migrations và seed tài khoản/căn nhà.
- **NILM:** kiểm tra dữ liệu và trọng số mô hình trong các archive, đường dẫn bundle và khả năng chạy
  worker. Không cần key OpenRouter để chạy suy luận NILM; có thể phải xuất/chuẩn bị bundle nếu archive chưa đủ.
- **Insight worker:** chạy tính hóa đơn, dự báo và cảnh báo từ dữ liệu đã có.
- **Email local:** dùng Mailpit theo Compose; chưa cần Gmail app password hay dịch vụ SMTP trả phí.
- **FE:** thay nguồn mock bằng API, thêm chat, xử lý phiên đăng nhập và tắt cờ demo bỏ qua login.

Máy hiện chưa có Docker trong PATH ở lần kiểm tra trước. Việc dựng hạ tầng và kiểm tra khả năng chạy
Docker/WSL là bước triển khai riêng; chỉ điền API key sẽ không giải quyết phần này.

## 9. Checklist gửi lại cho tôi

Sau khi chuẩn bị, bạn có thể nhắn theo mẫu này, không cần ghi giá trị khóa:

```text
File cấu hình: D:\Pinnovation2\wattprint-backend\.env
Google OAuth: đã điền / chưa có
Email Google dùng để thử: ...
OpenRouter key: đã điền / chưa có
Model: đã chọn ... / nhờ chọn model
OpenWeather: đã điền / đang vướng ...
AstralX: đã điền, có quyền STT và TTS / đang vướng ...
Repo hoặc URL Text2SQL: ... / chưa có
Triển khai đầy đủ FE + BE + NILM + chat + giọng nói + thời tiết + Text2SQL trong cùng đợt.
```

Khi nghiệm thu cần kiểm tra đủ: đăng nhập, dữ liệu điện từ backend, ước lượng thiết bị NILM,
hóa đơn/dự báo/cảnh báo, chat dựa trên dữ liệu căn nhà, hỏi SQL tự do, nói thành chữ,
đọc câu trả lời và thời tiết. Mục nào thiếu quyền truy cập hoặc cấu hình phải được ghi rõ.
