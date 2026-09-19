import { describe, expect, test } from "vitest";
import * as v from "valibot";

import type { Listing } from "~/lib/db/schema";
import type { ListingSearch } from "~/lib/listings";
import { sentenceCase, streetCase } from "~/lib/format";
import {
  ListingRecordSchema,
  listingToCallVariables,
  searchListings,
  toListingRow,
  toListingSummary,
} from "~/lib/listings";

// First line of chezy-mock-data/data/listings.jsonl, verbatim.
const FIXTURE_LINE =
  '{"platform":"fotocasa","platform_id":"183343174","url":"https://www.fotocasa.es/es/alquiler/vivienda/barcelona/aire-acondicionado-calefaccion-parking-jardin-terraza-trastero-ascensor-se-aceptan-mascotas-piscina/183343174/d","scraped_at":"2026-09-19T15:39:03.904965Z","published_at":"2024-05-21T13:27:30.090000Z","updated_at":"2024-05-21T13:27:30.090000Z","operation":"rent","price_eur":12000.0,"price_period":"month","price_per_m2":30.38,"price_drop_eur":null,"deposit":null,"is_temporary_rental":false,"property_type":"flat","property_subtype":"flat","built_m2":395.0,"usable_m2":null,"rooms":6,"bathrooms":6,"floor":null,"orientation":null,"year_built":null,"condition":null,"furnished":null,"heating":null,"energy_consumption_label":null,"energy_consumption_value":null,"energy_emissions_label":null,"energy_emissions_value":null,"lat":41.401818843434185,"lon":2.106874691035249,"street":null,"street_number":null,"neighbourhood":"Sarri\u00e0","district":"Sarri\u00e0 - Sant Gervasi","municipality":"Barcelona","postal_code":"08017","location_accuracy":"zone","amenities":["air_conditioning","wardrobes","heating","parking","garden","terrace","storage_room","elevator","balcony","gym","pets_allowed","pool","laundry","equipped_kitchen","fireplace","sea_view"],"raw_features":{"features":{"air_conditioner":1,"cabinets":2,"heating":3,"parking":5,"private_garden":7,"terrace":10,"storage_room":11,"elevator":13,"ensuite_bathroom":18,"balcony":32,"fitness_center":42,"pets_allowed":49,"community_pool":94,"laundry":109,"equiped_kitchen":131,"antiquity":2,"bathrooms":6,"hotWater":2,"orientation":1,"rooms":6,"surface":395},"dynamic_features":["HAS_A_FIREPLACE","HAS_VIEW_TO_BEACH","IS_MODERN","IS_VILLA"]},"media":[{"url":"https://static.fotocasa.es/images/ads/c72c8c63-de94-41aa-801e-d8c93a75529d?rule=original","kind":"photo","room_type":"swimming pool","width":null,"height":null,"local_path":"media/fotocasa/183343174/01-swimming-pool.webp"},{"url":"https://static.fotocasa.es/images/ads/48ff36ad-7cb9-46b5-a83d-b25d44c12f1c?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":"media/fotocasa/183343174/02-terrace.webp"},{"url":"https://static.fotocasa.es/images/ads/a4a1f833-07f5-4111-ae1c-6e980250cfb1?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":"media/fotocasa/183343174/03-exterior.webp"},{"url":"https://static.fotocasa.es/images/ads/4275988f-5468-4d27-a113-bbb9f0b6ec50?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":"media/fotocasa/183343174/04-exterior.webp"},{"url":"https://static.fotocasa.es/images/ads/74790a55-1911-4c74-9044-81715d71231a?rule=original","kind":"photo","room_type":"kitchen","width":null,"height":null,"local_path":"media/fotocasa/183343174/05-kitchen.webp"},{"url":"https://static.fotocasa.es/images/ads/c2a9109c-15fe-4be8-9afa-7dfcf4e0a8e5?rule=original","kind":"photo","room_type":"kitchen","width":null,"height":null,"local_path":"media/fotocasa/183343174/06-kitchen.webp"},{"url":"https://static.fotocasa.es/images/ads/c33a9a8b-c8b7-4d59-9d9a-d4db803b8de9?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":"media/fotocasa/183343174/07-other.webp"},{"url":"https://static.fotocasa.es/images/ads/8116ee5e-30a7-4780-b13d-272b63675430?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":"media/fotocasa/183343174/08-other.webp"},{"url":"https://static.fotocasa.es/images/ads/edaac3a7-e973-4532-9cb1-6e213d4908fe?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":"media/fotocasa/183343174/09-other.webp"},{"url":"https://static.fotocasa.es/images/ads/8c0c658f-61f4-46e7-b80c-7e2942b11258?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":"media/fotocasa/183343174/10-exterior.webp"},{"url":"https://static.fotocasa.es/images/ads/18fbbe33-0f54-4958-94cc-9b9d84ad3af9?rule=original","kind":"photo","room_type":"living room","width":null,"height":null,"local_path":"media/fotocasa/183343174/11-living-room.webp"},{"url":"https://static.fotocasa.es/images/ads/eae77f75-b68b-41fc-b009-44dcb3243171?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":"media/fotocasa/183343174/12-bathroom.webp"},{"url":"https://static.fotocasa.es/images/ads/470659f8-1749-4719-8970-ddd16452143c?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":"media/fotocasa/183343174/13-bathroom.webp"},{"url":"https://static.fotocasa.es/images/ads/5e3451f4-fa74-4892-8cf8-4b8e07ef1d59?rule=original","kind":"photo","room_type":"bedroom","width":null,"height":null,"local_path":"media/fotocasa/183343174/14-bedroom.webp"},{"url":"https://static.fotocasa.es/images/ads/ecb550cb-b50b-4414-a57a-7fe5e86acb7e?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":"media/fotocasa/183343174/15-terrace.webp"},{"url":"https://static.fotocasa.es/images/ads/463b951e-1934-461d-bc9d-75ca9d9b2d12?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":"media/fotocasa/183343174/16-terrace.webp"},{"url":"https://static.fotocasa.es/images/ads/e10ec5cb-e5af-4097-83ca-66ad60cd8927?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":"media/fotocasa/183343174/17-terrace.webp"},{"url":"https://static.fotocasa.es/images/ads/16fb93a0-a17f-431e-94dd-8c0f2349d06b?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":"media/fotocasa/183343174/18-terrace.webp"},{"url":"https://static.fotocasa.es/images/ads/8afad072-747d-433b-8e4d-e111eb457027?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":"media/fotocasa/183343174/19-other.webp"},{"url":"https://static.fotocasa.es/images/ads/3b709877-53e3-43ba-a9ef-6aa1dddf680e?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":"media/fotocasa/183343174/20-other.webp"},{"url":"https://static.fotocasa.es/images/ads/72e51c4e-8d1e-4062-a43f-fa351cd0ca9c?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":"media/fotocasa/183343174/21-other.webp"},{"url":"https://static.fotocasa.es/images/ads/5f0e0809-3b86-4d62-920d-ec1d3587b495?rule=original","kind":"photo","room_type":"kitchen","width":null,"height":null,"local_path":"media/fotocasa/183343174/22-kitchen.webp"},{"url":"https://static.fotocasa.es/images/ads/fd63cdad-3681-41dd-b44b-77c311647e0b?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":"media/fotocasa/183343174/23-other.webp"},{"url":"https://static.fotocasa.es/images/ads/7ecdd1b9-cb0e-48c6-a7cc-bdc79f1fdef4?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":"media/fotocasa/183343174/24-bathroom.webp"},{"url":"https://static.fotocasa.es/images/ads/5e02fc31-4ef3-49dc-91fc-535f23b5a18b?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":"media/fotocasa/183343174/25-bathroom.webp"},{"url":"https://static.fotocasa.es/images/ads/36cfde27-b212-4aaf-a57d-26d8259c55a4?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/f9af5ab5-2d26-4d39-9c09-73b81921e493?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/e6ca7be8-20ab-4e7a-b8b2-d0b23ddaa6d1?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/1eef7ccb-7835-4e8c-a6bd-a54805b5d6b7?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/18262c93-a066-4041-a84b-5062b08f835b?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/d007c700-b9db-4d13-9e05-3bf37c30ec83?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/f539a40c-6b76-419e-9d0a-9d6021aabf8d?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/e9d64bd6-97c7-47da-97d9-cb5f0f3c8cc8?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/b3e2151c-7cb5-4184-acb7-f11c2797eab3?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/fe94bd55-aeed-40b8-b6dc-5d9fac7d7953?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/7baf3b44-50c6-4665-bb62-dc509497ecbb?rule=original","kind":"photo","room_type":"bedroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/fcdc979c-01e3-4052-80f3-b93cbd0a67db?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/dbd5f279-8fc7-4799-b8f9-fb7a96cf1582?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/dada2dae-fc7f-4c5b-8a93-ec721b059fd6?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/e3133645-c1c2-43ba-becb-7d75814cb811?rule=original","kind":"photo","room_type":"bedroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/ac47233e-3881-47bc-ad2a-2806bef9fb17?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/09cd1b4c-9e3a-473c-8071-19bf00ed1e4e?rule=original","kind":"photo","room_type":"bedroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/328126da-6125-4b83-b33b-c449f787d22c?rule=original","kind":"photo","room_type":"bedroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/97888340-08b7-458d-aab2-ba96d9e56004?rule=original","kind":"photo","room_type":"bedroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/e28bf4ec-d88e-4342-a88a-7ba9f4835b27?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/50f5aaa9-f919-4800-b2db-7380e4aefbde?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/d28ea959-ddfd-46f2-9aaa-31ce683f7c4b?rule=original","kind":"photo","room_type":"bedroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/aa5878e1-71c1-4d81-83de-eb1850db1f64?rule=original","kind":"photo","room_type":"kitchen","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/9243ebfa-ba66-4094-9659-0e83a89e28fa?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/db4b481b-7ba8-4c12-bccd-72b50bf20513?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/5abde6f3-b27f-47d4-b89a-6c50de54650f?rule=original","kind":"photo","room_type":"other","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/c957d906-c5cc-408b-8ede-a79e0d163516?rule=original","kind":"photo","room_type":"living room","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/153c4d2d-fc10-4400-91c0-1686651adea6?rule=original","kind":"photo","room_type":"living room","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/dd3a4003-fea8-47c4-8b3f-63debf85abd9?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/2c8680ab-d30f-471c-b29d-2aa16f6000be?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/327160a8-eb29-455a-8066-83f414f6c384?rule=original","kind":"photo","room_type":"bathroom","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/2e1abd81-9cf7-4222-a7a7-e314e2f4b5e9?rule=original","kind":"photo","room_type":"terrace","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/36a88282-c055-4909-97db-4dab74a46265?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/d9d1cbc2-fc29-433f-8f5b-0d5f605835a4?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/2ca78997-3476-4076-8dac-7e4c0e2227d0?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":null},{"url":"https://static.fotocasa.es/images/ads/1b8e1034-c71f-4d69-918a-44858087978d?rule=original","kind":"photo","room_type":"exterior","width":null,"height":null,"local_path":null},{"url":"https://www.youtube.com/watch?v=herOSioqMOc","kind":"video","room_type":null,"width":null,"height":null,"local_path":null}],"publisher":{"name":"aProperties Real Estate Barcelona","kind":"professional","phone":null,"email":null,"profile_url":"https://www.fotocasa.es/es/pro/aproperties-real-estate-barcelona/"},"title":null,"description":"CASA CON PISCINA PRIVADA CON VISTAS AL MAR, CON 6 HABITACIONES Y 5 BA\u00d1OS\\n\\nEspectacular y moderna casa de 400m\u00b2 con piscina privada y vistas sensacionales de Barcelona. Se encuentra en la zona alta, ubicada en Can Caralleu, Sarri\u00e0.\\n\\nLa vivienda consta de cinco plantas con seis dormitorios y seis ba\u00f1os. Dispone de ascensor con acceso a las distintas plantas de la vivienda y aparcamiento para tres coches en el interior.\\n\\nAl entrar a la vivienda nos encontramos con un recibidor con acceso al ascensor y en el lateral un aseo de cortes\u00eda. Bajando unas escaleras encontramos el sal\u00f3n-comedor, muy luminoso y tranquilo con grandes ventanales y una chimenea de gas. A la izquierda del sal\u00f3n se encuentra la cocina americana de dise\u00f1o Bulthaup con electrodom\u00e9sticos Gaggenau. Desde el sal\u00f3n se accede al jard\u00edn y a la piscina.\\n\\nEn la primera planta, encontramos la habitaci\u00f3n principal en suite con salida a una terraza privada. La habitaci\u00f3n dispone de vestidor, ba\u00f1era de dise\u00f1o y ducha.\\n\\nEn la segunda planta, se disponen dos dormitorios dobles y exteriores, ambos dormitorios comparten un ba\u00f1o completo con ducha. En la misma planta se encuentra la zona de aguas.\\n\\nEn la tercera planta, se encuentra el tercer y cuarto dormitorio, ambos dobles y exteriores, con armarios empotrados, as\u00ed como una amplia sala polivalente y un ba\u00f1o completo con lavabo de dos senos y ducha.\\n\\nEn la cuarta planta, con el techo abuhardillado y con claraboya, encontramos una sala polivalente con un ba\u00f1o completo, desde esta sala, a trav\u00e9s de una escalera, llegamos a una espl\u00e9ndida y disfrutable terraza con las mejores vistas de Barcelona, donde se puede ver el mar.\\n\\nEn la planta inferior, encontramos una zona de aguas equipada con lavadero, lavadora secadora y zona de planchado y una zona de servicio con un dormitorio y un ba\u00f1o con ducha.\\n\\nEn la planta semis\u00f3tano, se ofrece un garaje con capacidad para tres veh\u00edculos que completa esta impresionante casa de obra nueva.\\n\\nLa casa es de estructura de hormig\u00f3n, con mezcla de piedra natural, grandes ventanales y contraventanas correderas de madera, que nos permiten jugar con la luz. En el suelo tenemos un parquet natural de roble, con calefacci\u00f3n radiante. La casa tambi\u00e9n tiene aire acondicionado y carpinter\u00eda de aluminio de m\u00e1xima calidad. La calificaci\u00f3n energ\u00e9tica de la casa es de nivel A.\\n\\n\u00bfTe gustar\u00eda vivir aqu\u00ed?  \\n* En cumplimiento de la Ley 12/2023 y la Ley 18/2007 informamos que:\\n\u00cdndice de R.P.LL: 0,00 \u20ac / m2 \\nRespecto a la presente propiedad no existe certificado informativo estatal de referencia de precios de alquiler.\\nNo consta contrato de arrendamiento de vivienda en los \u00faltimos 5 a\u00f1os.\\nEste propietario ostenta la condici\u00f3n de gran tenedor.\\nLa presente propiedad tiene la consideraci\u00f3n de suntuaria por raz\u00f3n de superficie y/o renta, y por ello, de conformidad con la LAU, no es de aplicaci\u00f3n el \u00edndice estatal de referencia de precios de alquiler.\\n Ref. AB2405044\\n\\nN\u00ba AICAT: 8446\\n\\nC\u00e9dula de habitabilidad: CHB04115121***\\nSe omiten los \u00faltimos tres d\u00edgitos para preservar el uso correcto de la informaci\u00f3n; el n\u00famero completo est\u00e1 disponible bajo solicitud de los interesados.","raw_html_excerpt":null,"source_raw":{}}';

const record = v.parse(ListingRecordSchema, JSON.parse(FIXTURE_LINE));

describe("toListingRow", () => {
  test("maps a real JSONL record to a Listing insert row", () => {
    const row = toListingRow(record);
    expect(row.id).toBe("fotocasa:183343174");
    expect(row.coverUrl).toBe(
      "https://static.fotocasa.es/images/ads/c72c8c63-de94-41aa-801e-d8c93a75529d?rule=original",
    );
    expect(row.amenities).toContain("pool");
    expect(row.amenities).toContain("air_conditioning");
    expect(row.operation).toBe("rent");
    // title is null in the dataset; falls back to the first description line
    expect(row.title).toBeTruthy();
    expect(row.media).toHaveLength(62);
  });
});

describe("toListingSummary", () => {
  test("truncates description to 300 chars", () => {
    const row = {
      ...toListingRow(record),
      createdAt: new Date(),
    } as Listing;
    const summary = toListingSummary(row);
    expect(summary.description).toHaveLength(300);
    expect(record.description!.length).toBeGreaterThan(300);
  });
});

describe("speech helpers", () => {
  test.each([
    ["FERRAN VALLS I TABERNER", "Ferran Valls i Taberner"],
    ["MARE DE DEU DEL COLL", "Mare de Deu del Coll"],
    ["Carrer del Capità Arenas", "Carrer del Capità Arenas"],
  ])("streetCase(%s) -> %s", (input, expected) => {
    expect(streetCase(input)).toBe(expected);
  });

  test.each([
    ["PISO EN ALQUILER TOTALMENTE EQUIPADO", "Piso en alquiler totalmente equipado"],
    ["Carrer de Verdi 42", "Carrer de Verdi 42"],
    ["DÚPLEX CON TERRAZA 'EXCLUSIVA'", "Dúplex con terraza ’exclusiva’"],
  ])("sentenceCase(%s) -> %s", (input, expected) => {
    expect(sentenceCase(input)).toBe(expected);
  });
});

describe("listingToCallVariables", () => {
  const base = {
    id: "fotocasa:1",
    title: "Piso",
    url: "https://example.com",
    coverUrl: null,
    pricePeriod: "month",
    bathrooms: 1,
    street: null,
    description: "",
  };

  test("rent with ALL-CAPS title and no street speaks clean Spanish", () => {
    const vars = listingToCallVariables({
      ...base,
      operation: "rent",
      priceEur: 2400,
      rooms: 2,
      builtM2: 64,
      street: null,
      neighbourhood: "La Nova Esquerra de l'Eixample",
      district: "Eixample",
      title: "PISO EN ALQUILER RECREATIVO DE DOS HABITACIONES TOTALMENTE EQUIPADO Y AMUEBLADO",
    });
    expect(vars.property_title).toMatch(/^Piso en alquiler/);
    expect(vars.property_price).toBe("2.400 euros al mes");
    expect(vars.property_summary).toBe(
      "piso de 2 habitaciones y 64 metros cuadrados en La Nova Esquerra de l’Eixample, por 2.400 euros al mes",
    );
    expect(vars.property_rooms).toBe("2");
    expect(vars.property_m2).toBe("64");
    expect(vars.property_ref).toBe("fotocasa:1");
    for (const value of Object.values(vars)) {
      expect(value).not.toMatch(/['€]/);
    }
  });

  test("street without thoroughfare prefix gets 'calle'", () => {
    const vars = listingToCallVariables({
      ...base,
      operation: "rent",
      priceEur: 1500,
      rooms: 1,
      builtM2: 40,
      street: "Gravina",
      neighbourhood: "El Raval",
      district: "Ciutat Vella",
    });
    expect(vars.property_location).toBe("calle Gravina, El Raval, Barcelona");
  });

  test("street with existing prefix keeps it", () => {
    const vars = listingToCallVariables({
      ...base,
      operation: "rent",
      priceEur: 1500,
      rooms: 1,
      builtM2: 40,
      street: "CARRER DE MUNTANER",
      neighbourhood: null,
      district: "Eixample",
    });
    expect(vars.property_location).toBe("Carrer de Muntaner, Eixample, Barcelona");
  });

  test("sale price reads 'euros' without period", () => {
    const vars = listingToCallVariables({
      ...base,
      operation: "sale",
      priceEur: 450000,
      rooms: null,
      builtM2: null,
      street: null,
      neighbourhood: null,
      district: "Gracia",
    });
    expect(vars.property_price).toBe("450.000 euros");
    expect(vars.property_location).toBe("Gracia");
    expect(vars.property_rooms).toBe("");
  });

  test("null rooms/m2/price collapse the summary gracefully", () => {
    const vars = listingToCallVariables({
      ...base,
      operation: "rent",
      priceEur: null,
      rooms: null,
      builtM2: null,
      street: null,
      neighbourhood: "Gràcia",
      district: "Gràcia",
    });
    expect(vars.property_summary).toBe("piso en Gràcia");
    expect(vars.property_price).toBe("");
  });
});

function row(partial: Partial<Listing> & Pick<Listing, "id">): Listing {
  return {
    platform: "fotocasa",
    platformId: partial.id.split(":")[1] ?? "x",
    url: `https://example.com/${partial.id}`,
    operation: "rent",
    priceEur: 1500,
    pricePeriod: "month",
    propertyType: "flat",
    builtM2: 60,
    rooms: 2,
    bathrooms: 1,
    floor: null,
    lat: null,
    lon: null,
    street: null,
    neighbourhood: null,
    district: null,
    municipality: "Barcelona",
    postalCode: null,
    amenities: [],
    title: "Piso",
    description: null,
    publisherName: null,
    publisherKind: null,
    coverUrl: null,
    media: [],
    publishedAt: null,
    createdAt: new Date(),
    ...partial,
  } as Listing;
}

const STOCK: Listing[] = [
  // The same Gràcia 1-room flat cross-posted on two portals (dedupe target).
  row({
    id: "fotocasa:gr1",
    platform: "fotocasa",
    priceEur: 1672,
    rooms: 1,
    builtM2: 45,
    district: "Gràcia",
    title: "Piso en Gràcia",
  }),
  row({
    id: "habitaclia:gr1",
    platform: "habitaclia",
    priceEur: 1672,
    rooms: 1,
    builtM2: 45,
    district: "Gràcia",
    title: "Piso en Gràcia",
  }),
  row({
    id: "fotocasa:gr3",
    priceEur: 4187,
    rooms: 3,
    builtM2: 95,
    district: "Gràcia",
    title: "Piso grande en Gràcia",
  }),
  row({
    id: "idealista:ex3",
    priceEur: 1800,
    rooms: 3,
    builtM2: 80,
    district: "Eixample",
    title: "Piso en Eixample",
  }),
  row({
    id: "idealista:ex1",
    priceEur: 1550,
    rooms: 1,
    builtM2: 50,
    district: "Eixample",
    title: "Estudio en Eixample",
  }),
  row({
    id: "fotocasa:sa4",
    priceEur: 9000,
    rooms: 4,
    builtM2: 200,
    district: "Sarrià - Sant Gervasi",
    neighbourhood: "Sarrià",
    title: "Casa en Sarrià",
  }),
];

// Mirrors the SQL: operation eq, query ILIKE on district/neighbourhood/title/
// description, price bounds, rooms >=. Ordered by price asc.
function fakeRun(search: ListingSearch) {
  const q = search.query?.toLowerCase();
  const rows = STOCK.filter(
    (r) =>
      (r.priceEur ?? 0) > 0 &&
      (!search.operation || r.operation === search.operation) &&
      (!q ||
        [r.title, r.district, r.neighbourhood, r.description]
          .filter((s): s is string => Boolean(s))
          .some((s) => s.toLowerCase().includes(q))) &&
      (search.minPriceEur === undefined || (r.priceEur ?? 0) >= search.minPriceEur) &&
      (search.maxPriceEur === undefined || (r.priceEur ?? 0) <= search.maxPriceEur) &&
      (search.minRooms === undefined || (r.rooms ?? 0) >= search.minRooms),
  ).sort((a, b) => (a.priceEur ?? 0) - (b.priceEur ?? 0));
  return Promise.resolve(rows);
}

describe("searchListings ladder", () => {
  test("exact match returns results with no relaxations", async () => {
    const res = await searchListings(
      { operation: "rent", query: "Gràcia", maxPriceEur: 2000, minRooms: 1 },
      fakeRun,
    );
    expect(res.relaxed).toEqual([]);
    expect(res.note).toBeUndefined();
    // The two cross-posted Gràcia 1-room flats dedupe to one.
    expect(res.total).toBe(1);
    expect(res.listings[0]?.id).toBe("fotocasa:gr1");
  });

  test("drops maxPriceEur first and reports the cheapest match", async () => {
    const res = await searchListings(
      { operation: "rent", query: "Gràcia", maxPriceEur: 2000, minRooms: 3 },
      fakeRun,
    );
    expect(res.relaxed).toEqual([{ field: "maxPriceEur", from: 2000, to: 4187 }]);
    expect(res.listings[0]?.id).toBe("fotocasa:gr3");
    expect(res.note).toContain("4.187");
  });

  test("then drops minRooms, reporting the max available", async () => {
    const res = await searchListings(
      { operation: "rent", query: "Gràcia", maxPriceEur: 2000, minRooms: 5 },
      fakeRun,
    );
    expect(res.relaxed.map((r) => r.field)).toEqual(["maxPriceEur", "minRooms"]);
    expect(res.relaxed[1]).toEqual({ field: "minRooms", from: 5, to: 3 });
    expect(res.listings.map((l) => l.id)).toContain("fotocasa:gr3");
  });

  test("finally drops query and shows other zones", async () => {
    const res = await searchListings(
      { operation: "rent", query: "Nowhere", maxPriceEur: 2000 },
      fakeRun,
    );
    expect(res.relaxed.at(-1)?.field).toBe("query");
    expect(res.listings.length).toBeGreaterThan(0);
    expect(res.note).toContain("Nowhere");
  });

  test("dedupe removes the cross-posted duplicate from totals", async () => {
    const res = await searchListings({ operation: "rent", minRooms: 1 }, fakeRun);
    // 6 rows, deduped to 5 (the habitaclia repost collapses).
    expect(res.total).toBe(5);
    expect(res.relaxed).toEqual([]);
  });

  test("returns empty when nothing can match", async () => {
    const res = await searchListings({ operation: "sale" }, fakeRun);
    expect(res.listings).toEqual([]);
    expect(res.total).toBe(0);
    expect(res.relaxed).toEqual([]);
    expect(res.note).toBeUndefined();
  });
});
