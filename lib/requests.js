// Demonstration-only data. These entries are not stored in a database.
export const requests = [
  {
    id: "BUY-001",
    direction: "buy",
    category: "Компания",
    title: "Компания в молочной отрасли",
    summary: "Поиск бизнеса для полного приобретения или покупки контрольной доли.",
    geography: ["Центральная Россия", "Сибирь"],
    priceFrom: 500,
    priceTo: 1000,
    priceLabel: "500–1 000 млн ₽",
    priceShort: "500–1 000 млн ₽",
    industry: "Производство продуктов питания",
    subindustry: "Молочная продукция",
    dealTypes: ["100% компании", "Контрольная доля"],
    revenue: "3 млрд ₽",
    businessModel: "B2B",
    manager: "ААА",
    unit: "БЮ Дзюба",
    note: "Клиент ищет компании для полного приобретения либо контрольного пакета акций, производство ГП, молочная отрасль."
  },
  {
    id: "SELL-001",
    direction: "sell",
    category: "Земельный участок",
    title: "Земельный участок под ИЖС",
    summary: "Продажа земельного участка в Московской области с возможностью строительства.",
    geography: ["Московская область"],
    priceFrom: 450,
    priceTo: 450,
    priceLabel: "450 млн ₽",
    priceShort: "450 млн ₽",
    permittedUse: "ИЖС",
    manager: "Бронников Николай",
    unit: "БЮ Ганушкин",
    note: "Крупная компания-клиент продает один из земельных участков, на месте находится поле, возможно строительство."
  }
];

export const categories = ["Компания", "Земельный участок", "Офис / склад / объект", "Производственная площадка"];

export const geographyOptions = ["Московская область", "Центральная Россия", "Сибирь"];

export const directionLabel = { buy: "Купить", sell: "Продать" };
export const directionNoun = { buy: "покупку", sell: "продажу" };

export const getRequest = (id) => requests.find((r) => r.id === id);

export function getDetailGroups(request) {
  if (request.category === "Земельный участок") {
    return [
      {
        title: "Параметры земельного участка",
        fields: [
          ["Тип объекта", request.category],
          ["Разрешённые виды строительства", request.permittedUse],
          ["География", request.geography.join(", ")],
          ["Стоимость", request.priceLabel]
        ]
      },
      {
        title: "Ответственный менеджер",
        fields: [
          ["Менеджер заявки", request.manager],
          ["Бизнес-юнит", request.unit]
        ]
      }
    ];
  }

  return [
    {
      title: "Параметры компании",
      fields: [
        ["Отрасль", request.industry],
        ["Подотрасль", request.subindustry],
        ["Тип сделки", request.dealTypes.join(" / ")],
        ["География", request.geography.join(" / ")],
        ["Стоимость / бюджет", request.priceLabel]
      ]
    },
    {
      title: "Финансовые и бизнес-показатели",
      fields: [
        ["Выручка", request.revenue],
        ["Бизнес-модель", request.businessModel]
      ]
    },
    {
      title: "Ответственный менеджер",
      fields: [
        ["Менеджер заявки", request.manager],
        ["Бизнес-юнит", request.unit]
      ]
    }
  ];
}
