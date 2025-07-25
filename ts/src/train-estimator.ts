import { ApiException, DiscountCard, InvalidTripInputException, TripRequest, Passenger } from "./model/trip.request";
import { TrainPriceApi } from "./composant/fetch-train";

export class TrainTicketEstimator {
    async estimate(trainDetails: TripRequest): Promise<number> {
        this.validateTripDetails(trainDetails);

        const basePrice = await TrainPriceApi.getBasePrice(
            trainDetails.details.from,
            trainDetails.details.to,
            trainDetails.details.when
        );

        const passengers = trainDetails.passengers;

        if (basePrice === -1) {
            throw new ApiException();
        }

        let totalPrice = 0;

        const familyDiscountLastNames = this.getFamilyDiscountLastNames(passengers);

        for (const passenger of passengers) {
            this.validatePassenger(passenger);

            if (passenger.lastName && familyDiscountLastNames.has(passenger.lastName)) {
                totalPrice += basePrice * 0.7;
                continue;
            }

            if (passenger.age < 1) continue;

            let price = this.getBasePassengerPrice(passenger, basePrice);
            price = this.applyDateAdjustments(trainDetails.details.when, price, basePrice);
            price = this.applySpecialCases(passenger, price, basePrice);

            totalPrice += price;
        }

        return this.applyGroupDiscounts(passengers, totalPrice, basePrice);
    }

    private validateTripDetails(trip: TripRequest): void {
        const { from, to, when } = trip.details;

        if (!from.trim()) {
            throw new InvalidTripInputException("Start city is invalid");
        }

        if (!to.trim()) {
            throw new InvalidTripInputException("Destination city is invalid");
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (when < today) {
            throw new InvalidTripInputException("Date is invalid");
        }

        if (trip.passengers.length === 0) {
            return;
        }
    }

    private validatePassenger(passenger: Passenger): void {
        if (passenger.age < 0) {
            throw new InvalidTripInputException("Age is invalid");
        }
    }

    private getBasePassengerPrice(passenger: Passenger, basePrice: number): number {
        if (passenger.age <= 17) {
            return basePrice * 0.6;
        }

        if (passenger.age >= 70) {
            let price = basePrice * 0.8;
            if (passenger.discounts.includes(DiscountCard.Senior)) {
                price -= basePrice * 0.2;
            }
            return price;
        }

        return basePrice * 1.2;
    }

    private applyDateAdjustments(tripDate: Date, price: number, basePrice: number): number {
        const now = new Date();
        const diffInMs = tripDate.getTime() - now.getTime();
        const diffHours = diffInMs / (1000 * 60 * 60);
        const diffDays = Math.ceil(diffInMs / (1000 * 3600 * 24));

        if (diffHours <= 6) {
            return price - basePrice * 0.2;
        }

        if (diffDays < 5) {
            return price + basePrice;
        }

        if (diffDays >= 5 && diffDays < 30) {
            return price + (20 - diffDays) * 0.02 * basePrice;
        }

        if (diffDays >= 30) {
            return price - basePrice * 0.2;
        }

        return price;
    }

    private applySpecialCases(passenger: Passenger, price: number, basePrice: number): number {
        if (passenger.age < 4) {
            return 9;
        }

        if (passenger.discounts.includes(DiscountCard.TrainStroke)) {
            return 1;
        }

        return price;
    }

    private applyGroupDiscounts(passengers: Passenger[], total: number, basePrice: number): number {
        const isMinorInGroup = passengers.some(p => p.age < 18);

        if (passengers.length === 2) {
            const hasCouple = passengers.some(p => p.discounts.includes(DiscountCard.Couple));
            if (hasCouple && !isMinorInGroup) {
                return total - basePrice * 0.2 * 2;
            }
        }

        if (passengers.length === 1) {
            const p = passengers[0];
            if (p.discounts.includes(DiscountCard.HalfCouple) && p.age >= 18) {
                return total - basePrice * 0.1;
            }
        }

        return total;
    }


    private getFamilyDiscountLastNames(passengers: Passenger[]): Set<string> {
        const familyNames = new Set<string>();

        for (const p of passengers) {
            if (p.lastName && p.discounts.includes(DiscountCard.Family)) {
                const matching = passengers.filter(
                    other => other.lastName === p.lastName
                );
                if (matching.length > 1) {
                    familyNames.add(p.lastName);
                }
            }
        }

        return familyNames;
    }
}
