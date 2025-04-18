import { TrainTicketEstimator } from "./train-estimator";
import { TripRequest, TripDetails, Passenger, DiscountCard, InvalidTripInputException, ApiException } from "./model/trip.request";

// 💡 Mock fetch pour simuler une réponse avec prix de base = 100€
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ price: 100 }),
  })
) as jest.Mock;

const estimator = new TrainTicketEstimator();
const futureDate = (days = 10): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

describe("Test sur les fonctionnalitées de base", () => {
  it("retourne 0 si aucun passager", async () => {
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate()), []);
    const result = await estimator.estimate(trip);
    expect(result).toBe(0);
  });
});
