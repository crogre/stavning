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
        geo: { shape: 'line', lines: [
          // Ucayali and Amazonas from Natural Earth; the last stretch to the Atlantic is hand-drawn,
          // because Natural Earth stops at the Xingu. Keep in step with tools/build-map.mjs.
          [[-49.9, 0.5], [-50.7, 0.1], [-51.1, -0.4], [-51.65, -1.35], [-52.66, -1.55], [-53.84, -1.96], [-54.47, -2.44], [-54.79, -2.12], [-55.15, -2.18], [-55.67, -1.93], [-56.13, -2.08], [-56.68, -2.57], [-57.51, -2.4], [-58.27, -3.21], [-58.81, -3.35], [-59.84, -3.09], [-61.89, -3.95], [-62.39, -3.72], [-63.1, -4.08], [-63.85, -3.84], [-65.48, -2.62], [-66.53, -2.43], [-66.71, -2.69], [-67.38, -2.62], [-67.74, -2.84], [-67.99, -3.33], [-69.35, -3.55], [-69.56, -4.3], [-69.95, -4.29], [-70.34, -3.81], [-71.06, -3.99], [-71.52, -3.83], [-71.79, -3.36], [-73.09, -3.56], [-73.19, -4.1], [-73.49, -4.44]],
          [[-71.67, -15.34], [-71.46, -14.69], [-71.55, -14.21], [-71.91, -13.81], [-73.22, -13.42], [-74.03, -12.17], [-74.26, -11.19], [-73.72, -11.19], [-74.03, -10.4], [-73.96, -9.86], [-74.54, -8.85], [-74.27, -8.48], [-74.5, -8.45], [-74.63, -8.03], [-74.95, -7.88], [-74.98, -7.44], [-75.28, -7.16], [-75.09, -6.83], [-75.18, -6.16], [-74.31, -5.74], [-74.05, -5.03], [-73.71, -4.89], [-73.49, -4.44]]
        ] } },
      { id: 'barriarrevet', name: 'Stora Barriärrevet', ok: 200, near: 800,
        info: 'Världens största korallrev, utanför Australiens nordöstra kust.',
        geo: { shape: 'area', rings: [[
          [142.5, -10], [144.5, -9.5], [145.5, -13], [147, -15.5], [149.5, -18], [151.5, -20], [153.5, -22], [153.5, -24.5],
          [151.5, -23.7], [149.5, -21.5], [147.5, -19], [146, -17], [145, -15], [143.5, -13], [143, -11]
        ]] } },
      { id: 'nilen', name: 'Nilen', ok: 200, near: 600,
        info: 'Afrikas längsta flod. Den rinner norrut genom Sudan och Egypten till Medelhavet.',
        geo: { shape: 'line', lines: [
          // Natural Earth 1:50m, same river lines as on the map. Vita Nilen with its upper reaches
          // from Victoriasjön, Blå Nilen from Lake Tana, then the Nile down to the two delta branches.
          [[33.19, 0.43], [32.74, -0.55], [31.77, -0.94]],
          [[32.89, 1.31], [33.19, 0.43]],
          [[32.54, 1.52], [32.89, 1.31]],
          [[32.48, 1.55], [32.54, 1.52]],
          [[32.24, 1.67], [32.48, 1.55]],
          [[31.37, 2.19], [32.25, 2.24], [32.34, 1.91], [32.1, 1.7], [32.24, 1.67]],
          [[31.37, 2.19], [31.47, 2.4]],
          [[32.02, 3.61], [31.72, 3.5], [31.4, 2.95], [31.47, 2.4]],
          [[32.02, 3.61], [31.52, 4.33], [31.77, 5.7], [31.15, 6.83]],
          [[31.15, 6.83], [30.55, 7.52], [30.2, 8.93], [30.46, 9.49], [31.12, 9.43]],
          [[31.12, 9.43], [31.52, 9.38], [32.04, 9.83], [32.27, 10.15], [32.11, 10.51], [32.65, 11.1], [32.8, 13], [32.17, 14.47], [32.49, 15.63]],
          [[37.18, 11.04], [36.98, 11.29], [37.11, 11.86]],
          [[37.11, 11.85], [37.26, 11.9], [37.39, 11.63]],
          [[37.39, 11.63], [38.46, 11.04], [38.38, 10.14], [37.66, 9.88], [36.48, 10.47], [36.21, 10.16], [35.72, 10], [35.35, 10.16]],
          [[35.35, 10.16], [35.15, 10.57], [35.16, 11.14], [34.78, 11.3]],
          [[34.38, 11.78], [34.78, 11.3]],
          [[34.38, 11.78], [33.93, 13.26], [33.59, 13.57], [33.57, 14.34], [33.13, 15.16], [32.49, 15.63]],
          [[32.49, 15.63], [32.63, 16.26], [33.71, 16.94], [33.94, 18.11], [33.38, 19.42], [33.02, 19.51], [32.08, 18.81], [31.47, 18.08], [30.81, 18.15], [30.35, 19.79], [30.59, 20.21], [30.32, 20.62], [31.09, 21.61]],
          [[32.88, 23.99], [32.91, 23.33], [32.58, 22.81], [32.04, 22.7], [31.09, 21.61]],
          [[32.88, 23.99], [32.87, 25.04], [32.49, 25.57], [32.76, 25.88], [32.73, 26.13], [32.02, 26.2], [30.87, 27.5], [30.74, 28.23], [31.22, 29.28], [31.24, 30.12]],
          [[31.24, 30.12], [30.85, 30.35], [30.75, 31.01], [30.4, 31.46]],
          [[31.16, 30.15], [31.24, 30.93], [31.84, 31.53]]
        ] } },
      { id: 'victoriasjon', name: 'Victoriasjön', ok: 150, near: 600,
        info: 'Afrikas största sjö, mellan Uganda, Kenya och Tanzania.',
        geo: { shape: 'area', rings: [
          // Natural Earth 1:50m, same shore as on the map.
          [[34.72, -0.09], [34.8, -0.3], [34.08, -0.58], [34.16, -0.88], [33.83, -1.36], [33.92, -1.51], [33.69, -1.49], [33.59, -1.76], [33.3, -1.92], [33.52, -2], [33.23, -2.07], [33.79, -2.12], [33.77, -2.24], [33.42, -2.53], [32.94, -2.42], [32.96, -2.85], [32.76, -2.98], [32.81, -2.52], [32.28, -2.28], [31.99, -2.55], [32, -2.76], [31.8, -2.79], [31.66, -1.93], [31.87, -1.09], [31.72, -0.79], [31.99, -0.32], [31.95, -0.13], [32.53, 0.07], [32.65, 0.25], [32.67, 0.12], [32.96, 0.11], [33.36, 0.47], [33.48, 0.22], [33.97, 0.21], [34.28, -0.35]]
        ] } },
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
        geo: { shape: 'line', lines: [
          // Natural Earth 1:50m, same river lines as on the map.
          [[148.01, -36.97], [148.2, -36.62], [147.97, -36.05], [147.46, -35.95], [147.27, -36.05], [147.04, -36.11], [146.47, -35.99], [146.22, -36.06], [146.03, -36.01], [145.22, -35.85], [144.96, -35.92], [144.92, -36.11], [144.67, -36.09], [144.16, -35.63], [143.4, -35.17], [143.33, -34.79], [142.77, -34.59], [142.57, -34.78], [142.37, -34.33], [142.16, -34.17], [141.76, -34.11], [141.47, -34.18], [140.95, -34], [140.76, -34.1], [140.77, -34.19], [140.53, -34.43], [140.25, -34.18], [139.72, -34.08], [139.61, -34.38], [139.62, -34.85], [139.29, -34.98], [139.43, -35.3], [139.3, -35.4]]
        ] } },
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
        geo: { shape: 'line', lines: [
          // Natural Earth 1:50m, same river lines as on the map.
          [[-95.03, 47.16], [-94.88, 47.45], [-94.64, 47.44], [-94.51, 47.46], [-94.33, 47.41], [-94.09, 47.43], [-93.31, 47.02], [-93.49, 46.73], [-94.06, 46.54], [-94.39, 46.19], [-94.13, 45.5], [-91.38, 43.99], [-91.07, 42.79], [-90.15, 42.05], [-90.44, 41.56], [-91.05, 41.37], [-90.95, 41.02], [-91.39, 40.54], [-91.5, 40.1], [-91.38, 39.75], [-90.66, 38.99], [-90.13, 38.85], [-90.37, 38.25], [-89.52, 37.64], [-89.49, 37.21], [-89.15, 36.99], [-89.13, 36.81], [-89.2, 36.63], [-89.55, 36.55], [-89.69, 35.92], [-89.94, 35.68], [-90.14, 35.11], [-91.21, 33.68], [-91.15, 32.63], [-90.94, 32.28], [-91.37, 31.77], [-91.66, 30.97], [-91.34, 30.71], [-91.11, 30.21], [-90.85, 30.04], [-89.93, 29.91], [-89.97, 29.69], [-89.29, 29.18], [-89.26, 29.16], [-89.02, 29.2]],
          [[-89.29, 29.18], [-89.18, 29.34]],
          [[-89.26, 29.16], [-89.38, 28.98]]
        ] } },
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
