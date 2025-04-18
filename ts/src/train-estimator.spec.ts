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
  it("retourne une erreur si la ville de départ est vide", async () => {
    const trip = new TripRequest(new TripDetails("", "Lyon", futureDate()), [new Passenger(25, [])]);
    await expect(estimator.estimate(trip)).rejects.toThrow(new InvalidTripInputException("Start city is invalid"));
  });

  it("retourne une erreur si la destination est vide", async () => {
    const trip = new TripRequest(new TripDetails("Paris", "", futureDate()), [new Passenger(25, [])]);
    await expect(estimator.estimate(trip)).rejects.toThrow(new InvalidTripInputException("Destination city is invalid"));
  });

  it("retourne une erreur si la date est est expiré", async () => {
    const pastDate = new Date("2024-12-01");
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", pastDate), [new Passenger(25, [])]);
    await expect(estimator.estimate(trip)).rejects.toThrow(new InvalidTripInputException("Date is invalid"));
  });

  it("retourne une erreur si l’API retourne -1", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        json: () => Promise.resolve({ price: -1 }),
      })
    );
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate()), [new Passenger(25, [])]);
    await expect(estimator.estimate(trip)).rejects.toThrow(new ApiException());
  });
  it("retourne 0 pour un bébé de moins d'1 an", async () => {
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate()), [new Passenger(0.5, [])]);
    const result = await estimator.estimate(trip);
    expect(result).toBe(0);
  });

  
  

});