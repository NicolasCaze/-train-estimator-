import { TrainTicketEstimator } from "./train-estimator";
import { TripRequest, TripDetails, Passenger, InvalidTripInputException, ApiException, DiscountCard } from "./model/trip.request";


global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true, 
    json: () => Promise.resolve({ price: 100 }),
  })
) as jest.Mock;


const estimator = new TrainTicketEstimator();
const futureDate = (days : number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

describe("Test sur les fonctionnalitées de base", () => {
  it("retourne 0 si aucun passager", async () => {
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate(10)), []);
    const result = await estimator.estimate(trip);
    expect(result).toBe(0);
  });
  it("retourne une erreur si la ville de départ est vide", async () => {
    const trip = new TripRequest(new TripDetails("", "Lyon", futureDate(15)), [new Passenger(25, [])]);
    await expect(estimator.estimate(trip)).rejects.toThrow(new InvalidTripInputException("Start city is invalid"));
  });

  it("retourne une erreur si la destination est vide", async () => {
    const trip = new TripRequest(new TripDetails("Paris", "", futureDate(20)), [new Passenger(25, [])]);
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
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate(10)), [new Passenger(25, [])]);
    await expect(estimator.estimate(trip)).rejects.toThrow(new ApiException());
  });
  it("retourne 0 pour un bébé de moins d'1 an", async () => {
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate(45)), [new Passenger(0.5, [])]);
    const result = await estimator.estimate(trip);
    expect(result).toBe(0);
  });

  it("retourne 9€ pour un enfant de moins de 3 ans", async () => {
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate(45)), [new Passenger(2, [])]);
    const result = await estimator.estimate(trip);
    expect(result).toBe(9);
  });

  it("applique une réduction de 40% pour un passager mineur de 18 ans", async () => {
    const basePrice = 100;
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate(50)),[new Passenger(10, [])]);
    const result = await estimator.estimate(trip);
    const expectedPrice = basePrice * 0.4;
    expect(result).toBeCloseTo(expectedPrice, 2);
  });

  it("applique une réduction de 20% pour un passager sénior de 70 ans", async () => {
    const basePrice = 100;
    const trip = new TripRequest(new TripDetails("Paris", "Lyon", futureDate(50)),[new Passenger(70, [])]);
    const result = await estimator.estimate(trip);
    const expectedPrice = 100 * 0.8 - 20;
    expect(result).toBeCloseTo(expectedPrice, 2);
  });
});
describe("Test pour les fonctionnalitées de tarification", () => {
  it("réduction sénior + carte sénior", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(40)),
      [new Passenger(75, [DiscountCard.Senior])]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeCloseTo(40, 2);
  });

  it("test pour un prix à 1€ avec TrainStroke", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [new Passenger(40, [DiscountCard.TrainStroke])]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBe(1);
  });

  it("test pour un prix standard adulte sans réduction", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [new Passenger(30, [])]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeGreaterThan(100); 
  });

  it("test pour une réduction anticipée de 20% pour date > 30 jours", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(40)),
      [new Passenger(30, [])]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeCloseTo(100 * 1.2 - 20, 2);
  });

  it("test sur l'augmentation selon le nombre de jours restants (entre 5 et 30)", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [new Passenger(30, [])]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeGreaterThan(120); 
  });

  it("test pour une réduction couple (2 adultes sans mineur)", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(35)),
      [
        new Passenger(28, [DiscountCard.Couple]),
        new Passenger(30, [])
      ]
    );
    const result = await estimator.estimate(trip);
    const basePrice = 100 * 1.2 - 20; 
    const totalBeforeReduction = basePrice * 2;
    expect(result).toBeCloseTo(totalBeforeReduction - 40, 2); 
  });

  it("test pour une réduction half-couple pour adulte seul", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(35)),
      [new Passenger(35, [DiscountCard.HalfCouple])]
    );
    const result = await estimator.estimate(trip);
    const expected = (100 * 1.2 - 20) - 10;
    expect(result).toBeCloseTo(expected, 2);
  });

  it("test pour quand il n'y a pas de réduction couple si un mineur est présent", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(35)),
      [
        new Passenger(28, [DiscountCard.Couple]),
        new Passenger(10, [])
      ]
    );
    const result = await estimator.estimate(trip);
    const expected = (100 * 1.2 - 20) + (100 * 0.6 - 20); 
    expect(result).toBeCloseTo(expected, 2);
  });

  it("test pour un cas combiné avec enfants, adultes et réduction", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(45)),
      [
        new Passenger(2, []), 
        new Passenger(10, []), 
        new Passenger(35, [DiscountCard.TrainStroke]) 
      ]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeCloseTo(9 + 40 + 1, 2);
  });

  it("test pour mix d’âge + réduction HalfCouple + Stroke", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(45)),
      [
        new Passenger(2, []), 
        new Passenger(35, [DiscountCard.HalfCouple]), 
        new Passenger(45, [DiscountCard.TrainStroke]) 
      ]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeCloseTo(110, 2); 

  });

  it("test pour une réduction de 20% si le départ est dans moins de 6h", async () => {
    const sixHoursLater = new Date();
    sixHoursLater.setHours(sixHoursLater.getHours() + 5);
  
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", sixHoursLater),
      [new Passenger(35, [])]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeCloseTo(100 * 1.2 - 20, 2); 
  });

  it("test pour une réduction de 30% à toute la famille avec la carte Famille", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [
        new Passenger(40, [DiscountCard.Family], "Dupont"),
        new Passenger(12, [], "Dupont"),
        new Passenger(45, [], "Durand") 
      ]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeCloseTo(280, 2);
  });

  it("retourne une erreur si la carte Famille est présente mais pas de nom de famille", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [
        new Passenger(40, [DiscountCard.Family]) 
      ]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeGreaterThan(100); 
  });

  it("retourne une erreur si le nom de famille n'est partagé avec personne", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [
        new Passenger(40, [DiscountCard.Family], "Dupont"),
        new Passenger(30, [], "Durand")
      ]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeGreaterThan(100 * 1.2); 
  });

  it("n'applique pas la réduction Famille si un seul passager possède le nom", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [new Passenger(40, [DiscountCard.Family], "Dupont")]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeGreaterThan(100); 
  });

  it("retourne une erreur si ne cumule pas réduction Famille avec TrainStroke (priorité Famille)", async () => {
    const trip = new TripRequest(
      new TripDetails("Paris", "Lyon", futureDate(10)),
      [
        new Passenger(40, [DiscountCard.Family, DiscountCard.TrainStroke], "Dupont"),
        new Passenger(35, [], "Dupont")
      ]
    );
    const result = await estimator.estimate(trip);
    expect(result).toBeCloseTo(140, 2); 
  });

  
  
});