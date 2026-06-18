import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'qs';
import {
  PaymentPort,
  CreatePaymentParams,
  PaymentCallbackResult,
} from '../../../common/ports/payment.port';

@Injectable()
export class VnpayAdapter implements PaymentPort {
  private readonly logger = new Logger(VnpayAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  private padStart(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private getVnpayDate(date: Date): string {
    const yyyy = date.getFullYear();
    const MM = this.padStart(date.getMonth() + 1);
    const dd = this.padStart(date.getDate());
    const HH = this.padStart(date.getHours());
    const mm = this.padStart(date.getMinutes());
    const ss = this.padStart(date.getSeconds());
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }

  private sortObject(obj: Record<string, string | number>): Record<string, string | number> {
    const sorted: Record<string, string | number> = {};
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b, 'en'));
    for (const key of keys) {
      if (obj[key] !== '' && obj[key] !== undefined && obj[key] !== null) {
        sorted[key] = obj[key];
      }
    }
    return sorted;
  }

  async createPaymentUrl(params: CreatePaymentParams): Promise<string> {
    const tmnCode = this.configService.get<string>('VNPAY_TMN_CODE', '');
    const hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET', '');
    const vnpUrl = this.configService.get<string>('VNPAY_SANDBOX_URL', '');
    const returnUrl = this.configService.get<string>('VNPAY_RETURN_URL', '');

    if (!tmnCode || !hashSecret) {
      this.logger.warn('VNPAY credentials are missing. Payment URL generation might fail.');
    }

    const createDate = new Date();
    // Amount must be multiplied by 100 for VNPAY
    let vnp_Params: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderDescription,
      vnp_OrderType: 'other',
      vnp_Amount: params.amount * 100,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: params.ipAddress || '127.0.0.1',
      vnp_CreateDate: this.getVnpayDate(createDate),
    };

    vnp_Params = this.sortObject(vnp_Params);
    
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;

    const finalUrl = vnpUrl + '?' + qs.stringify(vnp_Params, { encode: false });
    return finalUrl;
  }

  async verifyCallback(rawQuery: Record<string, string>): Promise<PaymentCallbackResult | null> {
    const hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET', '');
    
    let vnp_Params = { ...rawQuery };
    const secureHash = vnp_Params['vnp_SecureHash'];
    
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = this.sortObject(vnp_Params) as Record<string, string>;
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      const amount = parseInt(vnp_Params['vnp_Amount'] as string, 10) / 100;
      const isSuccess = vnp_Params['vnp_ResponseCode'] === '00' && vnp_Params['vnp_TransactionStatus'] === '00';
      return {
        amount,
        orderId: vnp_Params['vnp_TxnRef'] as string,
        providerTransactionId: vnp_Params['vnp_TransactionNo'] as string,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        rawData: rawQuery,
      };
    } else {
      this.logger.error('Invalid VNPAY signature');
      return null;
    }
  }
}
