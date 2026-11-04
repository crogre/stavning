// Weekly assignments. To add a week, put a new entry first in KK.WEEKS.
//
// Saved progress is keyed by place `id`, so never rename an id. A place that returns in a later
// week keeps its id and its progress. Put the place in that week with the same id.
//
// `ok` and `near` are distances in km. Within `ok` is rätt, within `near` is nära, beyond is fel.
// Areas count as 0 km from anywhere inside them. For scale: on a phone showing the whole
// world, one pixel is roughly 100 km.
//
// Coordinates are [longitude, latitude], east and north positive.
// geo.shape is one of:
//   point    { at:[lon,lat] }
//   parallel { lat }               a whole circle of latitude: the Equator or a pole
//   line     { lines:[[pt,...]] }  one or more polylines
//   area     { rings:[[pt,...]] }  outline, not repeating the first point. Must not cross ±180°;
//                                  split it into two rings if it does.
window.KK = window.KK || {};
KK.WEEKS = [
  {
    id: 'v45',
    name: 'Vecka 45',
    sub: 'Öknar, floder och berg',
    places: [
      { id: 'sahara', name: 'Saharaöknen', ok: 150, near: 800,
        info: 'Världens största varma öken. Den täcker stora delar av norra Afrika.',
        geo: { shape: 'area', rings: [[
          [-16.2, 20], [-14, 26], [-10, 29], [-5, 30.5], [0, 32], [5, 33], [9, 33], [11, 32.5], [14, 31.5], [19, 30.5],
          [22, 32], [25, 31.5], [29, 30.5], [32, 29.5], [33.5, 27.5], [35.5, 24], [37, 21], [37.5, 18.5],
          [35, 16], [30, 15.5], [24, 15.5], [18, 16], [12, 16], [5, 16.5], [-2, 16.5], [-8, 16.5], [-16, 16.5]
        ]] } },
      { id: 'kilimanjaro', name: 'Kilimanjaro', ok: 400, near: 1000,
        info: 'Afrikas högsta berg, 5 895 meter, i norra Tanzania.',
        geo: { shape: 'point', at: [37.355, -3.076] } },
      { id: 'gobi', name: 'Gobiöknen', ok: 200, near: 700,
        info: 'En stor och kall öken i Mongoliet och norra Kina.',
        geo: { shape: 'area', rings: [[
          [94, 42], [97, 44.5], [102, 45.5], [107, 46], [112, 45], [114, 43.5], [111, 42], [106, 41], [100, 40.5], [96, 40]
        ]] } },
      { id: 'amazonfloden', name: 'Amazonfloden', ok: 250, near: 700,
        info: 'Världens vattenrikaste flod. Den rinner från Anderna i Peru genom Brasilien till Atlanten.',
        geo: { shape: 'line', lines: [[
          [-74.1, -9.5], [-74.55, -8.38], [-75, -7.33], [-74.1, -5.3], [-73.6, -4.5], [-73.25, -3.75], [-71.5, -4.3],
          [-69.94, -4.21], [-67.9, -3.3], [-64.7, -3.35], [-62, -3.3], [-60, -3.1], [-57.5, -2.8], [-55.5, -1.9],
          [-54.7, -2.43], [-52.2, -1.6], [-51.6, -1.4], [-50.05, -0.05], [-49.2, 0.3]
        ]] } },
      { id: 'barriarrevet', name: 'Stora Barriärrevet', ok: 200, near: 800,
        info: 'Världens största korallrev, utanför Australiens nordöstra kust.',
        geo: { shape: 'area', rings: [[
          [142.5, -10], [144.5, -9.5], [145.5, -13], [147, -15.5], [149.5, -18], [151.5, -20], [153.5, -22], [153.5, -24.5],
          [151.5, -23.7], [149.5, -21.5], [147.5, -19], [146, -17], [145, -15], [143.5, -13], [143, -11]
        ]] } },
      { id: 'nilen', name: 'Nilen', ok: 200, near: 600,
        info: 'Afrikas längsta flod. Den rinner norrut genom Sudan och Egypten till Medelhavet.',
        geo: { shape: 'line', lines: [
          [[33.2, 0.4], [32.3, 2.3], [31.6, 4.85], [31.65, 9.53], [32.55, 15.6], [33.98, 17.7], [33.32, 19.53], [31.8, 18.47],
           [30.48, 19.17], [31.35, 21.8], [32.9, 24.09], [32.64, 25.69], [32.73, 26.16], [31.18, 27.18], [31.23, 30.04], [30.4, 31.45]],
          // Blå Nilen, from Lake Tana to Khartoum
          [[37.3, 12], [35.5, 11.2], [33.6, 13.5], [32.55, 15.6]]
        ] } },
      { id: 'victoriasjon', name: 'Victoriasjön', ok: 150, near: 600,
        info: 'Afrikas största sjö, mellan Uganda, Kenya och Tanzania.',
        geo: { shape: 'area', rings: [[
          [31.7, -0.5], [32.5, 0.2], [33.5, 0.4], [34.2, 0.2], [34.2, -1], [33.9, -2.2], [33, -2.6], [32, -2.5], [31.7, -1.5]
        ]] } },
      { id: 'klippiga', name: 'Klippiga bergen', ok: 200, near: 700,
        info: 'En lång bergskedja i västra Nordamerika, från Kanada till södra USA.',
        geo: { shape: 'area', rings: [[
          [-104.5, 35], [-104.5, 38], [-105, 41], [-106, 44], [-110, 47.5], [-113, 49], [-114.5, 51], [-118, 55], [-122, 58], [-125, 60],
          [-128, 59.5], [-124, 56], [-120, 53], [-117, 50], [-116, 47], [-114.5, 44.5], [-112, 42], [-110.8, 39], [-109, 36.5], [-107, 34.5]
        ]] } },
      { id: 'regnskogen', name: 'Amazonas regnskog', ok: 200, near: 800,
        info: 'Världens största regnskog. Den mesta av skogen ligger i Brasilien.',
        geo: { shape: 'area', rings: [[
          [-77, 2], [-72, 5], [-66, 5], [-60, 5.5], [-54, 4], [-50, 1.5], [-47, -1], [-47, -5], [-50, -8], [-54, -11],
          [-60, -13], [-66, -13], [-70, -12.5], [-74, -10], [-77, -5]
        ]] } },
      { id: 'murray', name: 'Murrayfloden', ok: 200, near: 600,
        info: 'Australiens längsta flod, i sydöstra delen av landet.',
        geo: { shape: 'line', lines: [[
          [148.2, -36.8], [146.9, -36.08], [144.75, -36.13], [143.55, -35.34], [142.15, -34.19], [140.75, -34.18],
          [139.67, -34.03], [139.27, -35.12], [138.88, -35.55]
        ]] } },
      { id: 'kalahari', name: 'Kalahariöknen', ok: 150, near: 600,
        info: 'En stor torr sandslätt i södra Afrika, främst i Botswana.',
        geo: { shape: 'area', rings: [[
          [18, -20], [21, -18], [25, -17.5], [27, -20], [27.5, -24], [25, -27], [21, -28.5], [18.5, -27], [17.5, -23]
        ]] } },
      { id: 'himalaya', name: 'Himalaya', ok: 200, near: 700,
        info: 'Världens högsta bergskedja, mellan Indien och Tibet.',
        geo: { shape: 'area', rings: [[
          [73.5, 35.8], [76, 35], [79, 33], [82, 31], [85, 30], [88, 29], [91, 29.5], [95, 30], [97, 28.5],
          [96, 27], [92, 26.7], [88, 26.6], [84, 27], [80, 28.5], [77.5, 30], [75, 32.5], [72.8, 34.5]
        ]] } },
      { id: 'mississippi', name: 'Mississippifloden', ok: 200, near: 600,
        info: 'En av Nordamerikas längsta floder. Den rinner genom USA till Mexikanska golfen.',
        geo: { shape: 'line', lines: [[
          [-95.2, 47.24], [-93.27, 44.98], [-91.25, 43.8], [-90.58, 41.5], [-91.35, 39.7], [-90.19, 38.63], [-89.18, 37],
          [-90.07, 35.15], [-91.15, 33.4], [-90.9, 32.35], [-91.2, 30.45], [-90.07, 29.95], [-89.25, 29.15]
        ]] } },
      { id: 'panamakanalen', name: 'Panamakanalen', ok: 350, near: 1000,
        info: 'En kanal genom Panama som förbinder Atlanten med Stilla havet.',
        geo: { shape: 'point', at: [-79.68, 9.08] } },
      { id: 'sydpolen', name: 'Sydpolen', ok: 1200, near: 2500,
        info: 'Jordens sydligaste punkt, på Antarktis. På den här kartan är den hela nederkanten.',
        geo: { shape: 'parallel', lat: -90 } },
      { id: 'nordpolen', name: 'Nordpolen', ok: 1200, near: 2500,
        info: 'Jordens nordligaste punkt, mitt i Norra ishavet. På den här kartan är den hela överkanten.',
        geo: { shape: 'parallel', lat: 90 } },
      { id: 'rodahavet', name: 'Röda havet', ok: 120, near: 500,
        info: 'Ett smalt hav mellan Afrika och Arabiska halvön.',
        geo: { shape: 'area', rings: [[
          [32.5, 29.9], [34.5, 28], [35, 29.5], [34.9, 28], [36.5, 25.5], [38.5, 22.5], [39.2, 21.4], [41, 18.5], [42.5, 16.5], [43.3, 13.5],
          [43.2, 12.6], [42.8, 13], [40, 15.5], [38.5, 18], [37.2, 20], [37, 22], [35.5, 24], [34, 26], [33.5, 27.5], [32.5, 29.5]
        ]] } },
      { id: 'everest', name: 'Mount Everest', ok: 300, near: 900,
        info: 'Världens högsta berg, 8 849 meter, i Himalaya mellan Nepal och Kina.',
        geo: { shape: 'point', at: [86.925, 27.988] } },
      { id: 'anderna', name: 'Anderna', ok: 150, near: 600,
        info: 'Världens längsta bergskedja på land, längs hela Sydamerikas västkust.',
        geo: { shape: 'area', rings: [[
          [-73, 11], [-77, 7], [-78.5, 3], [-79.5, -1], [-80, -5], [-78, -9], [-76, -13], [-72, -17], [-71, -20], [-70.5, -25], [-71, -30],
          [-71.5, -35], [-73, -40], [-74.5, -45], [-75, -50], [-73, -53], [-69, -55], [-67, -54.5], [-70.5, -50], [-71, -45], [-70.5, -40],
          [-69.5, -35], [-69, -30], [-66.5, -25], [-65, -20], [-66.5, -17], [-70, -14], [-73, -10], [-75.5, -6], [-76.5, -2], [-75.5, 2],
          [-73, 6], [-71, 9], [-70, 10.5]
        ]] } },
      { id: 'eldslandet', name: 'Eldslandet', ok: 200, near: 800,
        info: 'En ögrupp längst ner på Sydamerikas sydspets.',
        geo: { shape: 'area', rings: [[
          [-70.4, -52.7], [-68.5, -52.3], [-67.2, -53.9], [-65.1, -54.7], [-66.5, -55.1], [-67.3, -56], [-71, -55.5], [-74.5, -52.8], [-72, -53.2]
        ]] } },
      { id: 'ekvatorn', name: 'Ekvatorn', ok: 400, near: 1000,
        info: 'Den tänkta linjen runt jordens mitt, mellan norra och södra halvklotet.',
        geo: { shape: 'parallel', lat: 0 } }
    ]
  }
];
