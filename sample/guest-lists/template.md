# VIP Guest CSV Template

Day la file mau de BTC gui cho nhan hang tai tro dien danh sach khach moi VIP.

## 1. File can nop

- File phai o dinh dang `.csv`, ma hoa `UTF-8`, tach cot bang dau phay `,`.
- Dong dau tien phai giu nguyen ten cot nhu trong `template.csv`.
- Moi dong chi duoc khai bao 1 khach moi.
- Khong them ghi chu ben ngoai bang, khong merge cell, khong xuong dong trong mot o.

## 2. Cac cot trong file

### Bat buoc

- `full_name`: Ho va ten khach moi.
  - Vi du: `Nguyen Minh Anh`
- `email`: Email cua khach moi.
  - Bat buoc co gia tri.
  - Phai dung dinh dang email.
  - Khong duoc trung email voi dong khac trong cung file.
  - Vi du: `minh.anh@example.com`
- `ticket_type`: Ten loai ve VIP.
  - Bat buoc co gia tri.
  - Phai ghi DUNG CHINH TA ten loai ve ma BTC da cau hinh cho concert.
  - Nhan hang chi can dien TEN loai ve, khong can va khong nen dien UUID noi bo cua he thong.
  - Chi dung cac gia tri BTC da xac nhan, vi du: `VIP`, `SVIP`, `VVIP`.
  - Neu concert chi co `VIP` ma file ghi `SVIP` thi import se fail dong do.

### Khong bat buoc

- `guest_external_id`: Ma khach moi ben nhan hang de doi soat noi bo.
  - Nen duy nhat trong file.
  - Vi du: `SPONSOR-001`
- `phone`: So dien thoai khach moi.
  - Co the de trong.
  - Neu co gia tri, chi nen dung so va co the bat dau bang dau `+`.
  - Vi du hop le: `+84901234567`, `0901234567`
- `sponsor`: Ten nhan hang tai tro.
  - Vi du: `Brand A`
- `gate`: Cong / khu vuc check-in du kien.
  - Vi du: `VIP-A`, `GATE-01`
- `note`: Ghi chu them cho BTC.
  - Vi du: `CEO guest`, `Host guest`

## 3. Quy tac dien du lieu

- Khong doi ten cot.
- Khong xoa cac cot bat buoc.
- Co the de trong cac cot khong bat buoc.
- Khong de 2 dong trung cung `email`.
- Neu co `phone`, khong nen trung so dien thoai giua cac dong.
- Khong dung gia tri mau trong file khi gui lai cho BTC. Hay thay bang du lieu that.
- Moi file chi nen dung cho 1 concert.

## 4. Checklist truoc khi gui lai cho BTC

- Da thay toan bo dong vi du bang du lieu that.
- Da dung dung ten `ticket_type` theo danh sach BTC cung cap.
- Khong con dong trong hoac dong test.
- Khong con email sai dinh dang.
- Khong con email / phone bi trung trong cung file.

## 5. Mau gia tri ticket_type BTC nen gui kem

Vi `ticket_type` phu thuoc vao tung concert, BTC nen gui kem danh sach hop le cho nhan hang, vi du:

- `VIP`
- `SVIP`
- `VVIP`

Nhan hang chi duoc chon trong danh sach ma BTC gui, khong tu dat them gia tri moi.
