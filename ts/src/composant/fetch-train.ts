import { ApiException } from "../model/trip.request";

export class TrainPriceApi {
    static async getBasePrice(from: string, to: string, date: Date): Promise<number> {
        try {
            const response = await fetch(`https://sncftrenitaliadb.com/api/train/estimate/price?from=${from}&to=${to}&date=${date.toISOString()}`);
            if (!response.ok) throw new ApiException();

            const data = await response.json();
            const price = data?.price ?? -1;
            if (price === -1) throw new ApiException();

            return price;
        } catch {
            throw new ApiException();
        }
    }
}
