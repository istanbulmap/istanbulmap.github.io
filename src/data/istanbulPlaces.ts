/**
 * Curated Istanbul suggestions for the Favorites panel ("Discover Istanbul").
 *
 * Within each category the list is ordered by popularity (most visited first).
 *
 * COORDINATES are hand-curated approximations (usually within a few hundred metres).
 * When a suggestion is added, the app refines it through the geocoder and only
 * accepts a match within 1.5 km of these values (see utils/placeResolver.ts).
 * Entries named "district" / "street" / "quarter" point at the middle of an area,
 * not at a single building.
 */
import { LatLng, LocationCategory } from '../types';

export interface PlaceSuggestion {
  name: string;
  area: string;
  category: LocationCategory;
  position: LatLng;
  /** pre-folded text used by the search box */
  search: string;
}

/** Lower-case and strip Turkish/accented letters so "kadikoy" finds "Kadıköy". */
export const fold = (s: string): string =>
  s.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const P = (category: LocationCategory, name: string, area: string, lat: number, lng: number): PlaceSuggestion => ({
  name, area, category, position: { lat, lng }, search: fold(`${name} ${area} ${category}`),
});

const A = (n: string, a: string, lat: number, lng: number) => P('attraction', n, a, lat, lng);
const R = (n: string, a: string, lat: number, lng: number) => P('restaurant', n, a, lat, lng);
const C = (n: string, a: string, lat: number, lng: number) => P('cafe', n, a, lat, lng);
const H = (n: string, a: string, lat: number, lng: number) => P('hotel', n, a, lat, lng);
const S = (n: string, a: string, lat: number, lng: number) => P('shopping', n, a, lat, lng);
const T = (n: string, a: string, lat: number, lng: number) => P('transport', n, a, lat, lng);
const O = (n: string, a: string, lat: number, lng: number) => P('other', n, a, lat, lng);

const ATTRACTIONS: PlaceSuggestion[] = [
  A('Hagia Sophia',                    'Sultanahmet',  41.0086, 28.9802),
  A('Blue Mosque',                     'Sultanahmet',  41.0054, 28.9768),
  A('Topkapi Palace',                  'Sultanahmet',  41.0115, 28.9833),
  A('Basilica Cistern',                'Sultanahmet',  41.0084, 28.9779),
  A('Galata Tower',                    'Galata',       41.0256, 28.9744),
  A('Dolmabahce Palace',               'Beşiktaş',     41.0392, 29.0001),
  A('Suleymaniye Mosque',              'Fatih',        41.0162, 28.9640),
  A("Maiden's Tower",                  'Üsküdar',      41.0212, 29.0041),
  A('Istanbul Archaeology Museums',    'Sultanahmet',  41.0117, 28.9813),
  A('Taksim Square',                   'Taksim',       41.0370, 28.9850),
  A('Istiklal Avenue',                 'Beyoğlu',      41.0338, 28.9780),
  A('Bosphorus Bridge',                'Ortaköy',      41.0454, 29.0340),
  A('Galata Bridge',                   'Karaköy',      41.0199, 28.9738),
  A('Ortaköy Mosque',                  'Ortaköy',      41.0476, 29.0271),
  A('Beylerbeyi Palace',               'Üsküdar',      41.0424, 29.0432),
  A('Rumeli Fortress',                 'Sarıyer',      41.0846, 29.0565),
  A('Anadolu Fortress',                'Beykoz',       41.0832, 29.0672),
  A('Chora Church (Kariye)',           'Edirnekapı',   41.0312, 28.9390),
  A('Eyüp Sultan Mosque',              'Eyüp',         41.0477, 28.9337),
  A('Çamlıca Mosque',                  'Üsküdar',      41.0270, 29.0709),
  A('Hippodrome of Constantinople',    'Sultanahmet',  41.0058, 28.9753),
  A('Turkish and Islamic Arts Museum', 'Sultanahmet',  41.0063, 28.9747),
  A('Little Hagia Sophia',             'Sultanahmet',  41.0034, 28.9717),
  A('Column of Constantine',           'Sultanahmet',  41.0087, 28.9711),
  A('Yeni Cami (New Mosque)',          'Eminönü',      41.0166, 28.9706),
  A('Rüstem Pasha Mosque',             'Eminönü',      41.0171, 28.9689),
  A('Valens Aqueduct',                 'Fatih',        41.0155, 28.9570),
  A('Fener Greek Orthodox College',    'Fener',        41.0289, 28.9500),
  A('Ecumenical Patriarchate',         'Fener',        41.0240, 28.9505),
  A('Istanbul Modern',                 'Karaköy',      41.0266, 28.9821),
  A('SALT Galata',                     'Karaköy',      41.0233, 28.9741),
  A('Pera Museum',                     'Beyoğlu',      41.0317, 28.9741),
  A('Galata Mevlevi Lodge',            'Galata',       41.0283, 28.9743),
  A('Rahmi M. Koç Museum',             'Hasköy',       41.0488, 28.9487),
  A('Miniatürk',                       'Sütlüce',      41.0613, 28.9441),
  A('Sakıp Sabancı Museum',            'Emirgan',      41.1062, 29.0552),
  A('Yıldız Palace',                   'Beşiktaş',     41.0507, 29.0155),
  A('Yedikule Fortress',               'Zeytinburnu',  40.9931, 28.9226),
  A("Büyükada (Prince's Islands)",     'Adalar',       40.8760, 29.1297),
];

const RESTAURANTS: PlaceSuggestion[] = [
  R('Mikla Restaurant',                'Beyoğlu',      41.0312, 28.9742),
  R('Karaköy Lokantası',               'Karaköy',      41.0238, 28.9773),
  R('Çiya Sofrası (Kadıköy)',          'Kadıköy',      40.9901, 29.0245),
  R('Hamdi Restaurant',                'Eminönü',      41.0172, 28.9712),
  R('Pandeli',                         'Eminönü',      41.0165, 28.9705),
  R('Nusr-Et Steakhouse Etiler',       'Etiler',       41.0787, 29.0335),
  R('Karaköy Güllüoğlu',               'Karaköy',      41.0226, 28.9770),
  R('Balıkçı Sabahattin',              'Sultanahmet',  41.0047, 28.9815),
  R('Sultanahmet Köftecisi Selim Usta','Sultanahmet',  41.0073, 28.9764),
  R('Konyalı Restaurant',              'Sultanahmet',  41.0127, 28.9835),
  R('Asitane',                         'Edirnekapı',   41.0307, 28.9393),
  R('Neolokal',                        'Karaköy',      41.0233, 28.9741),
  R('360 Istanbul',                    'Beyoğlu',      41.0338, 28.9776),
  R('Balık Ekmek Boats',               'Eminönü',      41.0182, 28.9725),
  R('Kumkapı Meyhane Street',          'Kumkapı',      41.0023, 28.9690),
  R('Nevizade Street Meyhanes',        'Beyoğlu',      41.0349, 28.9768),
  R('Çiçek Pasajı',                    'Beyoğlu',      41.0343, 28.9769),
  R('Kadıköy Fish Market',             'Kadıköy',      40.9903, 29.0258),
  R('Beşiktaş Fish Market',            'Beşiktaş',     41.0430, 29.0075),
  R('Ortaköy Kumpir Square',           'Ortaköy',      41.0478, 29.0268),
  R('Arnavutköy Fish Restaurants',     'Arnavutköy',   41.0663, 29.0437),
];

const CAFES: PlaceSuggestion[] = [
  C('Mandabatmaz (Taksim)',            'Beyoğlu',      41.0346, 28.9765),
  C("Walter's Coffee Roastery",        'Moda',         40.9879, 29.0275),
  C('Kronotrop Coffee Bar',            'Cihangir',     41.0318, 28.9819),
  C('Fazıl Bey (Kadıköy)',             'Kadıköy',      40.9900, 29.0258),
  C('Pierre Loti Café',                'Eyüp',         41.0546, 28.9340),
  C('Hafız Mustafa 1864',              'Sirkeci',      41.0166, 28.9771),
  C('Mangerie Bebek',                  'Bebek',        41.0775, 29.0434),
  C('Moda Seaside Tea Garden',         'Moda',         40.9830, 29.0225),
  C('Çamlıca Hill Tea Garden',         'Üsküdar',      41.0268, 29.0677),
  C('Kanlıca Yoğurtçusu',              'Beykoz',       41.0985, 29.0635),
  C('Emirgan Sütiş',                   'Emirgan',      41.1078, 29.0535),
  C('Saray Muhallebicileri (İstiklal)','Beyoğlu',      41.0338, 28.9776),
  C('Cihangir Café Street (Akarsu Cd.)','Cihangir',    41.0312, 28.9832),
  C('Karaköy Coffee Row',              'Karaköy',      41.0236, 28.9775),
  C('Balat Café Street (Vodina Cd.)',  'Balat',        41.0290, 28.9490),
  C('Bebek Waterfront Cafés',          'Bebek',        41.0770, 29.0432),
  C('Moda Café Street',                'Moda',         40.9870, 29.0270),
  C('Nişantaşı Cafés (Abdi İpekçi)',   'Nişantaşı',    41.0490, 28.9945),
  C('Galata Cafés (Galip Dede Cd.)',   'Galata',       41.0280, 28.9738),
  C('Kuzguncuk Cafés',                 'Kuzguncuk',    41.0372, 29.0305),
  C('Çengelköy Tea Gardens',           'Çengelköy',    41.0515, 29.0522),
  C('Gülhane Park Tea Garden',         'Sultanahmet',  41.0128, 28.9815),
];

const HOTELS: PlaceSuggestion[] = [
  H('Four Seasons Sultanahmet',        'Sultanahmet',  41.0072, 28.9791),
  H('Four Seasons Bosphorus',          'Beşiktaş',     41.0447, 29.0125),
  H('Çırağan Palace Kempinski',        'Beşiktaş',     41.0458, 29.0165),
  H('Raffles Istanbul',                'Zorlu Center', 41.0678, 29.0180),
  H('The Marmara Taksim',              'Taksim',       41.0372, 28.9863),
  H('The Marmara Pera',                'Beyoğlu',      41.0310, 28.9740),
  H('Pera Palace Hotel',               'Beyoğlu',      41.0313, 28.9736),
  H('Park Hyatt Istanbul – Maçka Palas','Maçka',       41.0450, 28.9970),
  H('Swissôtel The Bosphorus',         'Maçka',        41.0430, 28.9995),
  H('The Ritz-Carlton Istanbul',       'Elmadağ',      41.0438, 28.9893),
  H('Hilton Istanbul Bomonti',         'Şişli',        41.0600, 28.9810),
  H('Witt Istanbul Suites',            'Cihangir',     41.0310, 28.9847),
  H('Georges Hotel Galata',            'Galata',       41.0262, 28.9756),
  H('Sultanahmet Hotel District',      'Sultanahmet',  41.0063, 28.9798),
  H('Taksim Hotel District',           'Taksim',       41.0380, 28.9840),
  H('Galata & Karaköy Boutique Hotels','Galata',       41.0258, 28.9760),
  H('Kadıköy Hotel District',          'Kadıköy',      40.9890, 29.0230),
  H('Beşiktaş Bosphorus Hotels',       'Beşiktaş',     41.0440, 29.0100),
  H('Nişantaşı Hotel District',        'Nişantaşı',    41.0480, 28.9900),
  H('Levent Business Hotels',          'Levent',       41.0800, 29.0120),
];

const SHOPPING: PlaceSuggestion[] = [
  S('Grand Bazaar',                    'Beyazıt',      41.0107, 28.9680),
  S('Spice Bazaar',                    'Eminönü',      41.0166, 28.9706),
  S('Kadikoy Market',                  'Kadıköy',      40.9897, 29.0255),
  S('Arasta Bazaar',                   'Sultanahmet',  41.0045, 28.9786),
  S('Mahmutpaşa Market',               'Eminönü',      41.0130, 28.9695),
  S('Sahaflar Book Bazaar',            'Beyazıt',      41.0107, 28.9648),
  S('Çukurcuma Antiques',              'Beyoğlu',      41.0310, 28.9810),
  S('Galataport',                      'Karaköy',      41.0268, 28.9828),
  S('Nişantaşı Shopping (Abdi İpekçi)','Nişantaşı',    41.0480, 28.9940),
  S('Kanyon',                          'Levent',       41.0782, 29.0113),
  S('Zorlu Center',                    'Beşiktaş',     41.0678, 29.0175),
  S('Cevahir Mall',                    'Şişli',        41.0632, 28.9945),
  S('Akmerkez',                        'Etiler',       41.0780, 29.0272),
  S('İstanbul Sapphire',               'Levent',       41.0869, 29.0128),
  S('Bahariye Street',                 'Kadıköy',      40.9876, 29.0290),
  S('Bağdat Avenue (Caddebostan)',     'Caddebostan',  40.9705, 29.0610),
  S('Laleli Textile Quarter',          'Laleli',       41.0105, 28.9540),
  S('Ortaköy Sunday Market',           'Ortaköy',      41.0472, 29.0265),
  S('Üsküdar Market',                  'Üsküdar',      41.0255, 29.0140),
  S('İstinye Park',                    'İstinye',      41.1085, 29.0105),
];

const TRANSPORT: PlaceSuggestion[] = [
  T('Istanbul Airport',                  'Airport (IST)',  41.2753, 28.7519),
  T('Sabiha Gokcen Airport',             'Airport (SAW)',  40.8986, 29.3092),
  T('Sirkeci Station (Marmaray)',        'Sirkeci',      41.0171, 28.9769),
  T('Yenikapı Station (Marmaray/M1/M2)', 'Yenikapı',     41.0042, 28.9512),
  T('Üsküdar Station (Marmaray/M5)',     'Üsküdar',      41.0228, 29.0152),
  T('Ayrılık Çeşmesi (Marmaray/M4)',     'Kadıköy',      40.9996, 29.0283),
  T('Haydarpaşa Station',                'Kadıköy',      41.0001, 29.0192),
  T('Taksim Metro (M2)',                 'Taksim',       41.0370, 28.9858),
  T('Şişhane Metro (M2)',                'Beyoğlu',      41.0278, 28.9731),
  T('Vezneciler Metro (M2)',             'Fatih',        41.0123, 28.9602),
  T('Levent Metro (M2/M6)',              'Levent',       41.0812, 29.0106),
  T('Mecidiyeköy Metro (M2/M7)',         'Şişli',        41.0670, 28.9936),
  T('Osmanbey Metro (M2)',               'Şişli',        41.0518, 28.9876),
  T('Aksaray (M1 / T1)',                 'Fatih',        41.0107, 28.9508),
  T('Kabataş (T1 / Funicular F1)',       'Kabataş',      41.0343, 28.9937),
  T('Eminönü (T1 Tram)',                 'Eminönü',      41.0172, 28.9726),
  T('Sultanahmet (T1 Tram)',             'Sultanahmet',  41.0069, 28.9778),
  T('Tünel (Historic Funicular)',        'Beyoğlu',      41.0279, 28.9741),
  T('Eminönü Ferry Pier',                'Eminönü',      41.0178, 28.9729),
  T('Karaköy Ferry Pier',                'Karaköy',      41.0221, 28.9784),
  T('Kadıköy Ferry Pier',                'Kadıköy',      40.9929, 29.0227),
  T('Üsküdar Ferry Pier',                'Üsküdar',      41.0267, 29.0154),
  T('Beşiktaş Ferry Pier',               'Beşiktaş',     41.0412, 29.0071),
  T('Büyükada Ferry Pier',               'Adalar',       40.8756, 29.1292),
  T('Harem Bus Terminal',                'Üsküdar',      41.0010, 29.0122),
  T('Esenler Bus Terminal (Otogar)',     'Esenler',      41.0405, 28.8929),
  T('Zincirlikuyu Metrobüs',             'Şişli',        41.0675, 29.0168),
];

const OTHER: PlaceSuggestion[] = [
  O('Gülhane Park',                    'Sultanahmet',  41.0132, 28.9817),
  O('Gezi Park',                       'Taksim',       41.0381, 28.9870),
  O('Pierre Loti Hill',                'Eyüp',         41.0545, 28.9340),
  O('Emirgan Park',                    'Emirgan',      41.1088, 29.0546),
  O('Yıldız Park',                     'Beşiktaş',     41.0495, 29.0150),
  O('Maçka Democracy Park',            'Maçka',        41.0438, 28.9958),
  O('Belgrad Forest',                  'Sarıyer',      41.1830, 28.9830),
  O('Çemberlitaş Hamamı',              'Sultanahmet',  41.0086, 28.9716),
  O('Cağaloğlu Hamamı',                'Sultanahmet',  41.0107, 28.9769),
  O('Kılıç Ali Paşa Hamamı',           'Tophane',      41.0262, 28.9843),
  O('Balat Colorful Streets',          'Balat',        41.0293, 28.9487),
  O('Cihangir Neighbourhood',          'Cihangir',     41.0315, 28.9835),
  O('Moda Neighbourhood',              'Moda',         40.9855, 29.0255),
  O('Kuzguncuk Village',               'Kuzguncuk',    41.0370, 29.0302),
  O('Arnavutköy Bosphorus Village',    'Arnavutköy',   41.0663, 29.0434),
  O('Bebek Seaside Promenade',         'Bebek',        41.0770, 29.0432),
  O('Çengelköy Waterfront',            'Çengelköy',    41.0518, 29.0518),
  O('Kilyos Beach',                    'Sarıyer',      41.2510, 29.0330),
  O('Istanbul University (Beyazıt Gate)','Beyazıt',    41.0116, 28.9643),
  O('Fenerbahçe Park & Lighthouse',    'Kadıköy',      40.9690, 29.0361),
];

export const PLACES: PlaceSuggestion[] = [
  ...ATTRACTIONS, ...RESTAURANTS, ...CAFES, ...HOTELS, ...SHOPPING, ...TRANSPORT, ...OTHER,
];

const CATEGORY_ORDER: LocationCategory[] = ['attraction', 'restaurant', 'cafe', 'hotel', 'shopping', 'transport', 'other'];

/** "All" view: round-robin across categories so the first page shows variety. */
const ALL_BY_RANK: PlaceSuggestion[] = (() => {
  const seen: Record<string, number> = {};
  return PLACES
    .map((p) => { const rank = (seen[p.category] = (seen[p.category] ?? -1) + 1); return { p, key: rank * 10 + CATEGORY_ORDER.indexOf(p.category) }; })
    .sort((a, b) => a.key - b.key)
    .map((x) => x.p);
})();

/** Suggestions for a category (or all), optionally filtered by a search string. */
export function suggestionsFor(category: LocationCategory | 'all', query = ''): PlaceSuggestion[] {
  const q = fold(query.trim());
  const pool = category === 'all' ? ALL_BY_RANK : PLACES.filter((p) => p.category === category);
  return q ? pool.filter((p) => p.search.includes(q)) : pool;
}

export function countsByCategory(): Record<LocationCategory, number> {
  const out = { restaurant: 0, cafe: 0, hotel: 0, attraction: 0, shopping: 0, transport: 0, other: 0 } as Record<LocationCategory, number>;
  for (const p of PLACES) out[p.category]++;
  return out;
}
