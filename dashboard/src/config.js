export const CONFIG = {
  // Feature Flags
  FEATURES: {
    ENABLE_BUY_ME_COFFEE: true,
    ENABLE_FOOTER: true,
    ENABLE_AUTHOR_CREDITS: true,
    ENABLE_DISCOVER: true,
    ENABLE_MAP: false, // Feature flag for Map view
  },

  // Home Page Categories Order & Display
  // You can add/remove/reorder these to change the homepage layout
  HOME_CATEGORIES: ["Casual", "Cafe & Coffee", "Special Occasion", "Bar"],

  // External Links
  LINKS: {
    BUY_ME_COFFEE: "https://buymeacoffee.com/nqhuy",
    GITHUB: "https://locbook.firstdraft.sh",
    AUTHOR_WEBSITE: "https://locbook.firstdraft.sh",
  },

  // Uncategorized Logic Configuration (Keywords mapped to Categories)
  CATEGORY_KEYWORDS: {
    "Special Occasion": [
      "romantic",
      "fine dining",
      "fancy",
      "steak",
      "wine",
      "anniversary",
      "celebration",
      "special occasion",
    ],
    Bar: ["bar", "pub", "cocktail", "lounge", "beer", "speakeasy", "wine"],
    "Cafe & Coffee": ["cafe", "coffee", "tea"],
    Casual: ["casual", "street", "local", "snack", "quick"],
  },
};
