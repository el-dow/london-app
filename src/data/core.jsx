import * as d3 from "d3";

// ——— Perceived neighbourhoods [area, name, lat, lng, blurb] ———
const HOODS = [
  ["Central", "Soho", 51.5136, -0.1365, "Neon, jazz bars and late-night noodles"],
  ["Central", "Covent Garden", 51.5117, -0.1240, "Street performers round the old market piazza"],
  ["Central", "Chinatown", 51.5108, -0.1310, "Lanterns, dim sum and bakery queues"],
  ["Central", "Seven Dials", 51.5147, -0.1273, "Seven streets meeting at a sundial"],
  ["Central", "Bloomsbury", 51.5220, -0.1280, "Garden squares, bookshops and the British Museum"],
  ["Central", "Fitzrovia", 51.5190, -0.1380, "Media studios above old literary pubs"],
  ["Central", "Marylebone", 51.5186, -0.1520, "Village high street with W1 polish"],
  ["Central", "Mayfair", 51.5100, -0.1470, "Galleries, grand hotels and quiet money"],
  ["Central", "St James's", 51.5063, -0.1370, "Old clubs, royal parkland, proper hats"],
  ["Central", "Westminster", 51.4995, -0.1300, "Abbey, Parliament and the big bell"],
  ["Central", "Holborn", 51.5174, -0.1180, "Legal London between the Inns of Court"],
  ["Central", "Clerkenwell", 51.5238, -0.1060, "Design studios in old gin distilleries"],
  ["Central", "Farringdon", 51.5198, -0.1043, "Railway crossroads with medieval alleys"],
  ["Central", "Barbican", 51.5200, -0.0937, "Concrete utopia with a hidden conservatory"],
  ["Central", "City of London", 51.5135, -0.0890, "Two thousand years in one square mile"],
  ["Central", "Temple", 51.5113, -0.1130, "Gas lamps and barristers' chambers"],
  ["Central", "Smithfield", 51.5188, -0.1000, "The old meat market, reinventing itself"],
  ["Central", "King's Cross", 51.5310, -0.1230, "Canalside rebirth behind two great stations"],
  ["North", "Camden Town", 51.5390, -0.1426, "Markets, mohawks and music venues"],
  ["North", "Kentish Town", 51.5504, -0.1407, "The Forum and proper locals' pubs"],
  ["North", "Primrose Hill", 51.5417, -0.1571, "Pastel terraces below the famous view"],
  ["North", "Hampstead", 51.5560, -0.1780, "Writers' village on the edge of the Heath"],
  ["North", "Belsize Park", 51.5500, -0.1640, "Red-brick mansions and quiet cafés"],
  ["North", "Highgate", 51.5716, -0.1480, "Georgian village above the famous cemetery"],
  ["North", "Archway", 51.5653, -0.1353, "The gateway up to Highgate Hill"],
  ["North", "Tufnell Park", 51.5560, -0.1380, "Quiet Victorian terraces between two hills"],
  ["North", "Islington", 51.5380, -0.1020, "Upper Street's restaurants and tiny theatres"],
  ["North", "Angel", 51.5320, -0.1060, "Antique arcades and canal locks"],
  ["North", "Highbury", 51.5520, -0.0970, "Leafy fields and Arsenal heartland"],
  ["North", "Holloway", 51.5520, -0.1130, "Big road, big crowds, big hearts"],
  ["North", "Stoke Newington", 51.5620, -0.0750, "Church Street's bookshops and brunch"],
  ["North", "Finsbury Park", 51.5650, -0.1060, "Where four railway lines and worlds meet"],
  ["North", "Crouch End", 51.5790, -0.1230, "Clocktower cafés, no tube, all charm"],
  ["North", "Muswell Hill", 51.5900, -0.1440, "Edwardian parades with Ally Pally views"],
  ["North", "Wood Green", 51.5970, -0.1090, "Shopping city of the north"],
  ["North", "Tottenham", 51.5880, -0.0680, "Stadium, marshes and deep roots"],
  ["North", "Swiss Cottage", 51.5430, -0.1740, "A library, a theatre and an alpine pub"],
  ["North", "Kilburn", 51.5470, -0.1940, "Irish London along the High Road"],
  ["North", "Queen's Park", 51.5340, -0.2050, "Bandstand brunches west of the tracks"],
  ["North", "Golders Green", 51.5720, -0.1940, "Bakeries, bagels and leafy avenues"],
  ["North", "Finchley", 51.5990, -0.1870, "Suburban avenues and an art deco cinema"],
  ["North", "Hendon", 51.5830, -0.2270, "RAF museum and red-brick suburbia"],
  ["North", "Mill Hill", 51.6130, -0.2410, "Green-belt edges and old farm lanes"],
  ["North", "Edgware", 51.6130, -0.2750, "Where the Northern line runs out"],
  ["North", "Barnet", 51.6520, -0.2000, "Hilltop market town at London's edge"],
  ["North", "Southgate", 51.6320, -0.1280, "A perfect circle of 1930s tube design"],
  ["North", "Palmers Green", 51.6180, -0.1090, "Quiet parades along Green Lanes"],
  ["North", "Enfield", 51.6520, -0.0810, "Market town with a New River"],
  ["North", "Edmonton", 51.6240, -0.0610, "Workaday north with Lea-side green"],
  ["East", "Shoreditch", 51.5255, -0.0786, "Street art, tech and all-night everything"],
  ["East", "Hoxton", 51.5320, -0.0820, "White-cube galleries and old boozers"],
  ["East", "Dalston", 51.5460, -0.0750, "Ridley Road market and basement clubs"],
  ["East", "Hackney Central", 51.5470, -0.0560, "Mare Street's mash of old and new"],
  ["East", "London Fields", 51.5410, -0.0610, "Lido lengths and pub gardens"],
  ["East", "Hackney Wick", 51.5430, -0.0250, "Warehouse studios on the canal"],
  ["East", "Clapton", 51.5610, -0.0560, "The Round Chapel and riverside marshes"],
  ["East", "Homerton", 51.5470, -0.0430, "Low-key streets beside the marshes"],
  ["East", "Bethnal Green", 51.5270, -0.0630, "Young V&A and proper pie shops"],
  ["East", "Whitechapel", 51.5190, -0.0610, "Gallery, market and immigrant histories"],
  ["East", "Spitalfields", 51.5190, -0.0750, "Huguenot silk houses and a buzzing market"],
  ["East", "Brick Lane", 51.5217, -0.0717, "Bagels at 3am, curry by 8"],
  ["East", "Mile End", 51.5250, -0.0330, "A green bridge over the Roman road"],
  ["East", "Bow", 51.5280, -0.0180, "Bells, canals and East End grit"],
  ["East", "Stratford", 51.5410, -0.0030, "Olympic legacy and Westfield crowds"],
  ["East", "Walthamstow", 51.5860, -0.0190, "A mile-long market and a neon junkyard"],
  ["East", "Leyton", 51.5610, -0.0120, "Matchday streets and Francis Road cafés"],
  ["East", "Leytonstone", 51.5680, 0.0080, "Hitchcock's birthplace by Epping's fringe"],
  ["East", "Forest Gate", 51.5490, 0.0240, "Coffee roasters edging Wanstead Flats"],
  ["East", "Canary Wharf", 51.5054, -0.0235, "Glass towers on the old docks"],
  ["East", "Isle of Dogs", 51.4920, -0.0180, "The river wraps it on three sides"],
  ["East", "Limehouse", 51.5120, -0.0390, "A marina and the Narrow Street wharves"],
  ["East", "Wapping", 51.5040, -0.0560, "Cobbled lanes and riverside stairs"],
  ["East", "Stepney", 51.5180, -0.0460, "City farm and Sunday football"],
  ["East", "Victoria Park Village", 51.5350, -0.0480, "Cafés at the people's park gate"],
  ["East", "Chingford", 51.6310, 0.0090, "Where the forest meets the suburbs"],
  ["East", "Woodford", 51.6070, 0.0340, "Leafy commuter calm by Epping"],
  ["East", "Wanstead", 51.5760, 0.0250, "Village green and grand old trees"],
  ["East", "Canning Town", 51.5140, 0.0080, "Bow Creek's fast-changing skyline"],
  ["East", "East Ham", 51.5320, 0.0550, "Curry houses and a grand old town hall"],
  ["East", "Barking", 51.5390, 0.0810, "Abbey ruins and riverside renewal"],
  ["East", "Ilford", 51.5590, 0.0720, "Big-town bustle and Valentines strolls"],
  ["East", "Dagenham", 51.5440, 0.1480, "Ford heritage and wide horizons"],
  ["East", "Romford", 51.5760, 0.1830, "A market town since 1247"],
  ["South", "Borough", 51.5010, -0.0930, "Foodie stalls beneath the Shard"],
  ["South", "Bermondsey", 51.4980, -0.0640, "The beer mile and antiques at dawn"],
  ["South", "Rotherhithe", 51.5010, -0.0470, "The Mayflower pub and looping river"],
  ["South", "Elephant & Castle", 51.4946, -0.1000, "Latin London at the roundabout"],
  ["South", "Kennington", 51.4880, -0.1080, "Georgian terraces and a proper park"],
  ["South", "Oval", 51.4820, -0.1130, "Gasholders over the cricket ground"],
  ["South", "Vauxhall", 51.4860, -0.1230, "Pleasure gardens, then and now"],
  ["South", "Nine Elms", 51.4800, -0.1330, "The power station's new glass quarter"],
  ["South", "Stockwell", 51.4720, -0.1230, "Little Portugal's pastéis de nata"],
  ["South", "Brixton", 51.4620, -0.1150, "Windrush heart, market and music"],
  ["South", "Herne Hill", 51.4530, -0.1020, "Sunday market by Brockwell's gates"],
  ["South", "Camberwell", 51.4740, -0.0920, "Art school energy and green spires"],
  ["South", "Peckham", 51.4730, -0.0690, "Rooftop bars and Rye Lane bustle"],
  ["South", "Nunhead", 51.4660, -0.0530, "Sleepy streets and a wild cemetery"],
  ["South", "Dulwich Village", 51.4450, -0.0860, "A picture gallery and white fingerposts"],
  ["South", "East Dulwich", 51.4560, -0.0750, "Lordship Lane's brunch belt"],
  ["South", "Forest Hill", 51.4390, -0.0530, "The Horniman walrus and hilltop views"],
  ["South", "Crystal Palace", 51.4180, -0.0710, "Dinosaurs below, views from the ridge"],
  ["South", "Clapham", 51.4620, -0.1380, "Common-side pubs and young London"],
  ["South", "Battersea", 51.4700, -0.1670, "Power station, park and peace pagoda"],
  ["South", "Balham", 51.4430, -0.1520, "Gateway to the south, as the joke goes"],
  ["South", "Tooting", 51.4270, -0.1680, "A lido, two markets and brilliant curry"],
  ["South", "Streatham", 51.4280, -0.1290, "The long high road and hidden commons"],
  ["South", "Wandsworth", 51.4570, -0.1920, "Old brewery town turned riverside"],
  ["South", "Putney", 51.4610, -0.2160, "Boat Race start and towpath runs"],
  ["South", "Wimbledon", 51.4220, -0.2080, "The tennis fortnight and womble common"],
  ["South", "Deptford", 51.4790, -0.0260, "Anchor, market and artist studios"],
  ["South", "New Cross", 51.4760, -0.0360, "Goldsmiths' art-school nights"],
  ["South", "Brockley", 51.4640, -0.0370, "Murals and a Saturday market"],
  ["South", "Lewisham", 51.4620, -0.0100, "Street market under the clock tower"],
  ["South", "Catford", 51.4450, -0.0210, "The giant cat watches over you"],
  ["South", "Greenwich", 51.4810, -0.0090, "The meridian and maritime grandeur"],
  ["South", "Blackheath", 51.4660, 0.0080, "Kite-flying heath and village charm"],
  ["South", "Woolwich", 51.4910, 0.0640, "Arsenal heritage and new docksides"],
  ["South", "Eltham", 51.4510, 0.0520, "An art deco palace in the suburbs"],
  ["South", "Kingston", 51.4120, -0.3000, "Ancient market town on the river"],
  ["South", "Surbiton", 51.3940, -0.3070, "Art deco station and riverside calm"],
  ["South", "New Malden", 51.4000, -0.2560, "Korean London's kitchen"],
  ["South", "Raynes Park", 51.4090, -0.2300, "Quiet rails-and-avenues suburbia"],
  ["South", "Morden", 51.4020, -0.1950, "End of the line, start of the park"],
  ["South", "Mitcham", 51.4060, -0.1660, "Cricket on the green since the 1680s"],
  ["South", "Sutton", 51.3620, -0.1940, "Hilly high street at the southern edge"],
  ["South", "Carshalton", 51.3680, -0.1670, "Ponds, lavender and village calm"],
  ["South", "Croydon", 51.3720, -0.1000, "Brutalism, boxparks and big ambitions"],
  ["South", "Thornton Heath", 51.3990, -0.1000, "Terraced streets round a clock tower"],
  ["South", "Norbury", 51.4110, -0.1220, "Between the commons and Croydon"],
  ["South", "South Norwood", 51.3980, -0.0750, "Lakes, Pissarro and Palace fans"],
  ["South", "Penge", 51.4130, -0.0540, "Victorian almshouses by the palace fringes"],
  ["South", "Beckenham", 51.4080, -0.0260, "Bowie's bandstand and leafy roads"],
  ["South", "Bromley", 51.4060, 0.0150, "Market square, Kent-turned-London"],
  ["South", "Chislehurst", 51.4170, 0.0680, "Caves and commons in the woods"],
  ["South", "Orpington", 51.3740, 0.0980, "Where London fades into Kent"],
  ["South", "Sidcup", 51.4260, 0.1040, "Suburban avenues, quietly proud"],
  ["South", "Bexleyheath", 51.4590, 0.1380, "William Morris's Red House and broad parades"],
  ["South", "Thamesmead", 51.5010, 0.1180, "Concrete lakes and film-set futurism"],
  ["West", "Notting Hill", 51.5090, -0.1960, "Carnival, cinema and candy-coloured crescents"],
  ["West", "Portobello", 51.5170, -0.2060, "The famous antiques mile"],
  ["West", "Holland Park", 51.5040, -0.2060, "Mews, mansions and opera in the park"],
  ["West", "Kensington", 51.4990, -0.1930, "Museum quarter and garden squares"],
  ["West", "South Kensington", 51.4940, -0.1740, "Dinosaurs, rockets and French cafés"],
  ["West", "Knightsbridge", 51.5010, -0.1600, "Harrods' green awnings"],
  ["West", "Belgravia", 51.4970, -0.1530, "White stucco and embassy quiet"],
  ["West", "Pimlico", 51.4890, -0.1340, "A stucco grid down to the river"],
  ["West", "Victoria", 51.4960, -0.1440, "Coaches, theatres and commuter tides"],
  ["West", "Chelsea", 51.4870, -0.1690, "King's Road swagger and flower shows"],
  ["West", "Earl's Court", 51.4900, -0.1940, "Bedsit land gone smart"],
  ["West", "Fulham", 51.4740, -0.2010, "Riverside greens and matchday roar"],
  ["West", "Hammersmith", 51.4920, -0.2230, "Riverside pubs beneath the bridge"],
  ["West", "Shepherd's Bush", 51.5050, -0.2240, "Empire gigs and market chatter"],
  ["West", "White City", 51.5120, -0.2240, "The BBC's old home, reinvented"],
  ["West", "Chiswick", 51.4920, -0.2540, "Riverside village with brewery air"],
  ["West", "Acton", 51.5080, -0.2730, "More stations than anywhere in London"],
  ["West", "Ealing", 51.5130, -0.3050, "Queen of the suburbs, film royalty"],
  ["West", "Paddington", 51.5160, -0.1760, "The bear, the basin and the trains"],
  ["West", "Bayswater", 51.5120, -0.1880, "Stucco terraces and global kitchens"],
  ["West", "Maida Vale", 51.5270, -0.1850, "Wide avenues and recording studios"],
  ["West", "Little Venice", 51.5230, -0.1830, "Narrowboats where two canals meet"],
  ["West", "Barnes", 51.4720, -0.2420, "Duck-pond village inside a river loop"],
  ["West", "Richmond", 51.4610, -0.3040, "Georgian green and the view from the hill"],
  ["West", "Kew", 51.4840, -0.2880, "Botanic gardens and a village green"],
  ["West", "Twickenham", 51.4470, -0.3260, "Rugby's cathedral and Eel Pie Island"],
  ["West", "Brentford", 51.4870, -0.3090, "Canal junction and a rising dockside"],
  ["West", "Willesden", 51.5460, -0.2330, "Zadie Smith's NW heartland"],
  ["West", "Harlesden", 51.5360, -0.2450, "Reggae heritage on the High Street"],
  ["West", "Wembley", 51.5520, -0.2960, "The arch you can see for miles"],
  ["West", "Harrow", 51.5800, -0.3340, "The school on the hill, the town below"],
  ["West", "Pinner", 51.5930, -0.3860, "Tudor high street, orchards in memory"],
  ["West", "Ruislip", 51.5760, -0.4230, "Lido woods and Metroland semis"],
  ["West", "Uxbridge", 51.5460, -0.4780, "Where the Metropolitan line ends"],
  ["West", "Greenford", 51.5290, -0.3460, "Quiet crescents and canal-side green"],
  ["West", "Southall", 51.5110, -0.3760, "Little Punjab's bazaars and bhangra"],
  ["West", "Hanwell", 51.5080, -0.3380, "Brunel's viaduct and a flight of locks"],
  ["West", "Hounslow", 51.4680, -0.3610, "Flight paths and a long high street"],
  ["West", "Isleworth", 51.4710, -0.3290, "Old wharves opposite Kew's trees"],
  ["West", "Teddington", 51.4250, -0.3320, "Locks, studios and riverside pubs"],
  ["West", "Hampton", 51.4150, -0.3670, "Riverside village by the palace"],
];

// ——— Green spaces [area, name, lat, lng, approx radius m, blurb] ———
const GREENS = [
  ["Royal Parks", "Hyde Park", 51.5073, -0.1657, 620, "Speakers' Corner and the Serpentine"],
  ["Royal Parks", "Kensington Gardens", 51.5070, -0.1790, 560, "Peter Pan and the Round Pond"],
  ["Royal Parks", "Regent's Park", 51.5310, -0.1570, 660, "Rose gardens and open-air theatre"],
  ["Royal Parks", "Primrose Hill", 51.5390, -0.1600, 300, "The whole skyline from one summit"],
  ["Royal Parks", "St James's Park", 51.5025, -0.1340, 300, "Pelicans with a palace view"],
  ["Royal Parks", "Green Park", 51.5040, -0.1430, 270, "Deckchairs and plane trees, nothing else"],
  ["Royal Parks", "Richmond Park", 51.4420, -0.2740, 1700, "Six hundred deer and ancient oaks"],
  ["Royal Parks", "Greenwich Park", 51.4770, 0.0000, 500, "Stand on the meridian, see the city"],
  ["Royal Parks", "Bushy Park", 51.4130, -0.3340, 1100, "The chestnut avenue and wandering deer"],
  ["Royal Parks", "Hampton Court Park", 51.4040, -0.3200, 700, "The Long Water and palace deer haunts"],
  ["North", "Hampstead Heath", 51.5608, -0.1630, 1000, "Swimming ponds and wild hilltops"],
  ["North", "Parliament Hill", 51.5570, -0.1500, 320, "The protected view of everything"],
  ["North", "Highgate Wood", 51.5780, -0.1530, 300, "Ancient oak and hornbeam, plus a café"],
  ["North", "Waterlow Park", 51.5690, -0.1450, 200, "A garden for the gardenless"],
  ["North", "Alexandra Park", 51.5940, -0.1230, 500, "Ally Pally's sweeping slopes"],
  ["North", "Finsbury Park", 51.5700, -0.0990, 420, "Boating lake and gig fields"],
  ["North", "Clissold Park", 51.5610, -0.0890, 280, "Deer, goats and a Georgian villa"],
  ["North", "Highbury Fields", 51.5470, -0.1010, 200, "Islington's green front room"],
  ["North", "Abney Park Cemetery", 51.5650, -0.0760, 200, "A wild Victorian arboretum of rest"],
  ["North", "Walthamstow Wetlands", 51.5860, -0.0530, 600, "Europe's largest urban wetland"],
  ["North", "Trent Park", 51.6660, -0.1410, 800, "Country-estate woods at the line's end"],
  ["East", "Victoria Park", 51.5360, -0.0390, 580, "The people's park since 1845"],
  ["East", "London Fields", 51.5420, -0.0600, 200, "Lido lengths and weekend haze"],
  ["East", "Hackney Marshes", 51.5560, -0.0250, 600, "Eighty-odd football pitches at dawn"],
  ["East", "Queen Elizabeth Olympic Park", 51.5430, -0.0130, 650, "Velodrome, wildflowers and the Orbit"],
  ["East", "Mile End Park", 51.5210, -0.0350, 300, "The green bridge over the road"],
  ["East", "Tower Hamlets Cemetery Park", 51.5230, -0.0290, 200, "Woodland reclaiming the stones"],
  ["East", "Mudchute Park & Farm", 51.4900, -0.0140, 250, "Farm animals under Canary Wharf"],
  ["East", "Epping Forest", 51.6300, 0.0400, 1800, "Six thousand ancient acres"],
  ["East", "Wanstead Flats", 51.5630, 0.0250, 550, "Skylarks over open grassland"],
  ["East", "Lee Valley Park", 51.5950, -0.0420, 800, "Reservoirs and riverside miles"],
  ["East", "Hainault Forest", 51.6110, 0.1070, 700, "A remnant of the great Essex forest"],
  ["East", "Valentines Park", 51.5740, 0.0680, 300, "Boating lake and walled gardens"],
  ["East", "Wanstead Park", 51.5720, 0.0320, 350, "A lost mansion, surviving lakes"],
  ["South", "Battersea Park", 51.4790, -0.1560, 450, "A peace pagoda on the Thames"],
  ["South", "Clapham Common", 51.4570, -0.1500, 580, "Three ponds and summer crowds"],
  ["South", "Brockwell Park", 51.4530, -0.1090, 400, "A lido and a hilltop hall"],
  ["South", "Burgess Park", 51.4830, -0.0830, 430, "A park built where streets once stood"],
  ["South", "Southwark Park", 51.4950, -0.0540, 300, "A Victorian oval with its own gallery"],
  ["South", "Peckham Rye", 51.4600, -0.0660, 380, "Where Blake saw his angels"],
  ["South", "Dulwich Park", 51.4440, -0.0780, 330, "Boats and bikes by the picture gallery"],
  ["South", "Sydenham Hill Wood", 51.4380, -0.0680, 240, "Ancient wood with a ghost railway"],
  ["South", "Horniman Gardens", 51.4410, -0.0610, 200, "The walrus museum's flowering terraces"],
  ["South", "Crystal Palace Park", 51.4230, -0.0650, 480, "Victorian dinosaurs by the lake"],
  ["South", "Nunhead Cemetery", 51.4630, -0.0510, 240, "Gothic ruins under green canopy"],
  ["South", "Blackheath", 51.4690, 0.0030, 550, "Wide sky and kite strings"],
  ["South", "Oxleas Wood", 51.4650, 0.0640, 400, "Eight thousand years of woodland"],
  ["South", "Beckenham Place Park", 51.4220, -0.0190, 480, "A mansion, lake swims and trails"],
  ["South", "Morden Hall Park", 51.4030, -0.1880, 400, "Watermills and rose gardens"],
  ["South", "Tooting Common", 51.4350, -0.1530, 480, "The grand old lido and its avenues"],
  ["South", "Wandsworth Common", 51.4480, -0.1740, 380, "Railside lakes and plane-tree walks"],
  ["South", "Wimbledon Common", 51.4350, -0.2350, 1000, "Windmill, woods and wombles"],
  ["South", "Nonsuch Park", 51.3640, -0.2280, 500, "Where Henry's palace vanished"],
  ["South", "Mitcham Common", 51.3960, -0.1480, 450, "Gorse and golf on old heathland"],
  ["South", "South Norwood Country Park", 51.3980, -0.0570, 350, "Wild meadows around a lake"],
  ["South", "Danson Park", 51.4520, 0.1100, 300, "A Georgian villa above the boating lake"],
  ["South", "Lesnes Abbey Woods", 51.4890, 0.1230, 350, "Abbey ruins and fossil beds"],
  ["West", "Holland Park", 51.5028, -0.2030, 300, "The Kyoto Garden and its peacocks"],
  ["West", "Ravenscourt Park", 51.4940, -0.2360, 240, "A walled garden and paddling pool"],
  ["West", "Chiswick House Gardens", 51.4840, -0.2580, 300, "Palladian villa and camellias"],
  ["West", "Gunnersbury Park", 51.4930, -0.2880, 400, "Rothschild mansions and museums"],
  ["West", "Kew Gardens", 51.4790, -0.2950, 650, "The Palm House and treetop walk"],
  ["West", "Barnes Wetland Centre", 51.4770, -0.2360, 300, "Kingfishers, ten miles from Charing Cross"],
  ["West", "Osterley Park", 51.4870, -0.3520, 550, "A Tudor-Georgian house in farmland"],
  ["West", "Syon Park", 51.4790, -0.3110, 400, "A duke's estate with a tidal meadow"],
  ["West", "Fryent Country Park", 51.5850, -0.2750, 450, "Hay meadows with Wembley views"],
  ["West", "Horsenden Hill", 51.5530, -0.3260, 350, "An ancient hilltop above the canal"],
  ["West", "Brent Reservoir (Welsh Harp)", 51.5760, -0.2480, 400, "A sailing reservoir fringed with reeds"],
  // ——— Smaller neighbourhood parks & gardens ———
  ["North", "Camley Street Natural Park", 51.5358, -0.1268, 110, "A canalside wild patch behind King's Cross"],
  ["North", "Gillespie Park", 51.5566, -0.1041, 130, "A railway-side nature reserve in Highbury"],
  ["North", "Barnard Park", 51.5375, -0.1108, 150, "Islington's scrappy, beloved green"],
  ["North", "Paddington Recreation Ground", 51.5337, -0.1907, 230, "Maida Vale's running track and lawns"],
  ["North", "Ruskin Park edge", 51.5708, -0.1389, 120, "Pocket green below Highgate Hill"],
  ["North", "Caledonian Park", 51.5470, -0.1170, 170, "A clock tower over old market land"],
  ["North", "Spa Fields", 51.5263, -0.1075, 100, "A Clerkenwell green with radical history"],
  ["North", "Coram's Fields", 51.5238, -0.1218, 130, "A park where no adult may enter without a child"],
  ["North", "Russell Square", 51.5219, -0.1259, 95, "Bloomsbury's grand plane-shaded square"],
  ["North", "Myatt's Fields", 51.4742, -0.1018, 150, "A Victorian park with a bandstand"],
  ["East", "Haggerston Park", 51.5333, -0.0712, 180, "A city farm and BMX track in Hackney"],
  ["East", "Shoreditch Park", 51.5347, -0.0840, 200, "Open lawns where the gasworks stood"],
  ["East", "Weavers Fields", 51.5240, -0.0640, 180, "Bethnal Green's big open sky"],
  ["East", "Allen Gardens", 51.5224, -0.0686, 150, "A green strip along the old Brick Lane railway"],
  ["East", "Meath Gardens", 51.5283, -0.0420, 150, "A former cemetery turned quiet park"],
  ["East", "Wapping Gardens", 51.5042, -0.0560, 110, "Riverside green among the old docks"],
  ["East", "King Edward Memorial Park", 51.5083, -0.0480, 160, "A bandstand on the Shadwell foreshore"],
  ["East", "Ion Square Gardens", 51.5290, -0.0658, 80, "A tiny restored Victorian square"],
  ["East", "Millfields", 51.5560, -0.0480, 220, "Lea-side commons in Clapton"],
  ["East", "Springfield Park", 51.5670, -0.0567, 200, "A hillside view over the marshes"],
  ["South", "Larkhall Park", 51.4732, -0.1227, 150, "Stockwell's calm, leafy local"],
  ["South", "Slade Gardens", 51.4710, -0.1158, 110, "An adventure playground and green in Stockwell"],
  ["South", "Vauxhall Park", 51.4838, -0.1230, 160, "A model village among the flowerbeds"],
  ["South", "Spring Gardens", 51.4877, -0.1112, 90, "A pocket park by the Oval"],
  ["South", "Kennington Park", 51.4860, -0.1063, 200, "Where the Chartists once gathered"],
  ["South", "Geraldine Mary Harmsworth Park", 51.4955, -0.1090, 170, "Lawns around the Imperial War Museum"],
  ["South", "Ruskin Park", 51.4665, -0.0962, 200, "Herne Hill's slope with a pond and portico"],
  ["South", "Myatts Fields South", 51.4710, -0.0970, 110, "A quiet green below Camberwell"],
  ["South", "Eveline Lowe green", 51.4885, -0.0680, 90, "A Bermondsey pocket of lawn"],
  ["South", "Tabard Gardens", 51.4980, -0.0850, 120, "A Borough green tucked behind the estates"],
  ["South", "Mountsfield Park", 51.4480, -0.0150, 170, "Catford's hilltop with city views"],
  ["South", "Hilly Fields", 51.4615, -0.0290, 180, "A Brockley ridge with a stone circle"],
  ["South", "Telegraph Hill Park", 51.4790, -0.0420, 150, "Upper and lower greens above New Cross"],
  ["South", "Brenchley Gardens", 51.4555, -0.0640, 120, "A ridge walk on an old railway"],
  ["South", "Ladywell Fields", 51.4540, -0.0170, 200, "The Ravensbourne winds through it"],
  ["South", "Manor House Gardens", 51.4555, -0.0050, 140, "A lake and a Georgian house in Lee"],
  ["South", "Brockwell edge", 51.4505, -0.1015, 110, "Herne Hill's walled community greens"],
  ["South", "Archbishop's Park", 51.4960, -0.1180, 130, "Lambeth Palace's public lawns"],
  ["South", "Eel Brook Common", 51.4775, -0.1970, 150, "A Fulham triangle of grass"],
  ["South", "South Park", 51.4710, -0.1930, 160, "Fulham's tidy Victorian park"],
  ["West", "Brook Green", 51.4930, -0.2210, 130, "A leafy strip between Hammersmith and Kensington"],
  ["West", "Normand Park", 51.4855, -0.2010, 130, "A West Ken green among mansion blocks"],
  ["West", "St Quintin Park", 51.5200, -0.2180, 110, "A North Kensington local"],
  ["West", "Meanwhile Gardens", 51.5235, -0.2025, 100, "A community garden on the canal"],
  ["West", "Avondale Park", 51.5095, -0.2095, 120, "Notting Dale's small, tidy green"],
  ["West", "Emslie Horniman's Pleasance", 51.5210, -0.2090, 100, "A Voysey-designed walled garden"],
  ["West", "Wormwood Scrubs", 51.5180, -0.2370, 360, "A vast rough common by the prison"],
  ["West", "Little Wormwood Scrubs", 51.5165, -0.2200, 130, "The Scrubs' tamer little sibling"],
  ["West", "Bishops Park", 51.4710, -0.2150, 180, "A riverside promenade by Fulham Palace"],
  ["West", "Furnivall Gardens", 51.4905, -0.2335, 110, "A Hammersmith green on the Thames path"],
  ["West", "Acton Park", 51.5055, -0.2620, 150, "A Victorian park with a moated mound"],
  ["West", "Walpole Park", 51.5105, -0.3095, 200, "Ealing's lake and gardens by Pitzhanger Manor"],
];

// ——— Hand-traced base map geometry (lng, lat) ———
const THAMES = [
  [-0.415, 51.392], [-0.385, 51.403], [-0.345, 51.402], [-0.308, 51.406], [-0.302, 51.413],
  [-0.318, 51.428], [-0.330, 51.442], [-0.335, 51.448], [-0.307, 51.458], [-0.298, 51.470],
  [-0.290, 51.486], [-0.283, 51.490], [-0.270, 51.484], [-0.263, 51.470], [-0.249, 51.464],
  [-0.235, 51.471], [-0.230, 51.487], [-0.220, 51.490], [-0.215, 51.478], [-0.214, 51.468],
  [-0.200, 51.462], [-0.188, 51.466], [-0.179, 51.475], [-0.168, 51.481], [-0.155, 51.484],
  [-0.137, 51.485], [-0.127, 51.488], [-0.122, 51.495], [-0.121, 51.503], [-0.115, 51.509],
  [-0.103, 51.510], [-0.088, 51.508], [-0.074, 51.505], [-0.060, 51.502], [-0.050, 51.505],
  [-0.043, 51.510], [-0.033, 51.510], [-0.029, 51.503], [-0.028, 51.493], [-0.024, 51.485],
  [-0.010, 51.483], [-0.001, 51.490], [0.000, 51.500], [0.004, 51.507], [0.017, 51.508],
  [0.030, 51.503], [0.046, 51.496], [0.063, 51.491], [0.080, 51.498], [0.095, 51.511],
  [0.120, 51.514], [0.150, 51.501], [0.175, 51.488], [0.205, 51.483],
];
const RIVER_LEA = [
  [0.004, 51.509], [-0.002, 51.520], [-0.005, 51.535], [-0.015, 51.550], [-0.022, 51.565],
  [-0.035, 51.580], [-0.045, 51.595], [-0.050, 51.612], [-0.055, 51.640], [-0.050, 51.665],
];
const REGENTS_CANAL = [
  [-0.183, 51.523], [-0.156, 51.535], [-0.143, 51.541], [-0.124, 51.535], [-0.103, 51.536],
  [-0.076, 51.536], [-0.043, 51.536], [-0.033, 51.525], [-0.038, 51.512],
];
const GRAND_UNION = [
  [-0.183, 51.523], [-0.205, 51.520], [-0.226, 51.530], [-0.270, 51.530], [-0.300, 51.538],
  [-0.325, 51.534], [-0.345, 51.536], [-0.330, 51.515], [-0.318, 51.498], [-0.308, 51.488],
];
const ROADS = [
  [[-0.151, 51.503], [-0.190, 51.495], [-0.223, 51.492], [-0.255, 51.490], [-0.305, 51.488], [-0.380, 51.482], [-0.500, 51.480]],
  [[-0.165, 51.518], [-0.220, 51.520], [-0.280, 51.525], [-0.360, 51.532], [-0.440, 51.542], [-0.500, 51.546]],
  [[-0.106, 51.532], [-0.120, 51.548], [-0.135, 51.565], [-0.155, 51.585], [-0.176, 51.600], [-0.210, 51.618], [-0.245, 51.645], [-0.265, 51.665]],
  [[-0.081, 51.527], [-0.075, 51.545], [-0.073, 51.562], [-0.067, 51.590], [-0.063, 51.618], [-0.068, 51.650], [-0.070, 51.685]],
  [[-0.093, 51.498], [-0.063, 51.483], [-0.040, 51.476], [-0.005, 51.470], [0.040, 51.462], [0.090, 51.452], [0.150, 51.440], [0.210, 51.432]],
  [[-0.100, 51.494], [-0.125, 51.473], [-0.138, 51.462], [-0.175, 51.455], [-0.215, 51.443], [-0.250, 51.430], [-0.290, 51.415], [-0.330, 51.392], [-0.365, 51.365]],
  [[-0.114, 51.486], [-0.115, 51.462], [-0.126, 51.443], [-0.131, 51.428], [-0.122, 51.410], [-0.105, 51.385], [-0.100, 51.360], [-0.108, 51.340]],
  [[-0.060, 51.519], [-0.033, 51.525], [-0.003, 51.540], [0.030, 51.572], [0.070, 51.578], [0.120, 51.580], [0.183, 51.580], [0.210, 51.583]],
  [[-0.070, 51.511], [-0.040, 51.512], [0.008, 51.515], [0.050, 51.527], [0.082, 51.532], [0.140, 51.530], [0.210, 51.520]],
  [[-0.260, 51.495], [-0.293, 51.530], [-0.265, 51.555], [-0.240, 51.568], [-0.215, 51.576], [-0.180, 51.602], [-0.140, 51.612], [-0.105, 51.615], [-0.060, 51.618], [-0.020, 51.600], [0.020, 51.592], [0.045, 51.575], [0.062, 51.550], [0.068, 51.525]],
  [[-0.285, 51.485], [-0.255, 51.470], [-0.220, 51.462], [-0.190, 51.458], [-0.160, 51.460], [-0.140, 51.460], [-0.110, 51.455], [-0.085, 51.450], [-0.050, 51.441], [-0.020, 51.445], [0.010, 51.465], [0.040, 51.478], [0.060, 51.490]],
  [[-0.163, 51.515], [-0.176, 51.530], [-0.195, 51.546], [-0.215, 51.562], [-0.240, 51.583], [-0.262, 51.605], [-0.275, 51.620]],
];

// ——— Projection ———
const LNG_MIN = -0.505, LNG_MAX = 0.215, LAT_MIN = 51.335, LAT_MAX = 51.690;
const COS0 = Math.cos((51.51 * Math.PI) / 180);
const K = 2800;
const W = (LNG_MAX - LNG_MIN) * COS0 * K;
const H = (LAT_MAX - LAT_MIN) * K;
const UNITS_PER_M = K / 111320;
const px = (lng) => (lng - LNG_MIN) * COS0 * K;
const py = (lat) => (LAT_MAX - lat) * K;
const linePath = (pts) => "M" + pts.map(([lng, lat]) => `${px(lng).toFixed(1)},${py(lat).toFixed(1)}`).join("L");
const toLatLng = ([x, y]) => [LAT_MAX - y / K, x / (COS0 * K) + LNG_MIN];

const AREA_COLORS = {
  Central: "#D6402C", North: "#2747B8", East: "#E08712",
  South: "#1B8A4C", West: "#A23073", "Royal Parks": "#0E7A52",
};
const AREA_ORDER = ["Central", "North", "East", "South", "West", "Royal Parks"];

const STORAGE_KEY = "london-explorer-v1";
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const STATE_LABEL = ["unexplored", "want to go", "visited"];

const PLACES = {
  hoods: HOODS.map(([area, name, lat, lng, blurb]) => ({ area, name, blurb, kind: "hood", id: `n:${slug(name)}`, x: px(lng), y: py(lat) })),
  green: GREENS.map(([area, name, lat, lng, r, blurb]) => ({ area, name, blurb, kind: "park", id: `g:${slug(name)}`, x: px(lng), y: py(lat), r: r * UNITS_PER_M })),
};

// ——— Geometry helpers ———
function clipPolygon(subject, clip) {
  let output = subject;
  for (let i = 0; i < clip.length && output.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    const side = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
    const intersect = (p, q) => {
      const a1 = B[1] - A[1], b1 = A[0] - B[0], c1 = a1 * A[0] + b1 * A[1];
      const a2 = q[1] - p[1], b2 = p[0] - q[0], c2 = a2 * p[0] + b2 * p[1];
      const det = a1 * b2 - a2 * b1;
      return det === 0 ? p : [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j + input.length - 1) % input.length];
      const curIn = side(cur) >= 0, prevIn = side(prev) >= 0;
      if (curIn) {
        if (!prevIn) output.push(intersect(prev, cur));
        output.push(cur);
      } else if (prevIn) output.push(intersect(prev, cur));
    }
  }
  return output;
}
const toPath = (pts) => (pts.length ? `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}Z` : "");

function blobPts(cx, cy, r, seed, n = 18) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const w = 1 + 0.13 * Math.sin(seed * 3.7 + i * 2.1) + 0.09 * Math.cos(seed * 1.9 + i * 3.3);
    pts.push([cx + r * w * Math.cos(t), cy + r * w * Math.sin(t)]);
  }
  return pts;
}
function pathFromPts(pts) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    d += `Q${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${((p1[0] + p2[0]) / 2).toFixed(1)},${((p1[1] + p2[1]) / 2).toFixed(1)}`;
  }
  return d + "Z";
}

const HOOD_CELLS = (() => {
  const pts = PLACES.hoods.map((p) => [p.x, p.y]);
  const voronoi = d3.Delaunay.from(pts).voronoi([-80, -80, W + 80, H + 80]);
  // Clip the whole mosaic to one padded hull around every neighbourhood,
  // so cells tile edge-to-edge with no gaps between zones.
  const cx = d3.mean(pts, (p) => p[0]), cy = d3.mean(pts, (p) => p[1]);
  const PAD = 1500 * UNITS_PER_M;
  let boundary = d3.polygonHull(pts).map(([x, y]) => {
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * PAD, y + (dy / len) * PAD];
  });
  const sh = boundary.reduce((s, [x, y], i) => {
    const [x2, y2] = boundary[(i + 1) % boundary.length];
    return s + (x * y2 - x2 * y);
  }, 0);
  if (sh < 0) boundary = boundary.slice().reverse();
  return PLACES.hoods.map((p, i) => {
    let cell = voronoi.cellPolygon(i) || [];
    if (cell.length > 1) {
      const f = cell[0], l = cell[cell.length - 1];
      if (f[0] === l[0] && f[1] === l[1]) cell = cell.slice(0, -1);
    }
    const clipped = clipPolygon(cell, boundary);
    const poly = clipped.length ? clipped : cell;
    return { ...p, path: toPath(poly), latlngs: poly.map(toLatLng) };
  });
})();

const GREEN_SHAPES = PLACES.green.map((p, i) => {
  const pts = blobPts(p.x, p.y, p.r, i + 1);
  return { ...p, path: pathFromPts(pts), latlngs: pts.map(toLatLng) };
});
const THAMES_PATH = linePath(THAMES);
const BASE_WATER = [RIVER_LEA, REGENTS_CANAL, GRAND_UNION].map(linePath);
const ROAD_PATHS = ROADS.map(linePath);

// ——— Illustrated postcard (used when a real photo can't be loaded) ———
function Postcard({ name, area, kind }) {
  const color = AREA_COLORS[area] || "#444";
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 9973;
  const v = (i) => ((h * (i + 3)) % 100) / 100;
  const sunX = 210 - (h % 60);
  return (
    <svg viewBox="0 0 252 118" style={{ display: "block", width: "100%" }} aria-hidden>
      {/* Sky */}
      <rect width="252" height="118" fill="#EAF2F7" />
      <rect width="252" height="118" fill={color} opacity="0.07" />
      <circle cx={sunX} cy={24 + (h % 8)} r="12" fill="#F2C173" opacity="0.9" />
      {[0, 1].map((i) => (
        <g key={i} fill="#FFFFFF" opacity="0.85">
          <ellipse cx={40 + i * 120 + v(i) * 40} cy={20 + v(i + 2) * 14} rx="17" ry="6" />
          <ellipse cx={54 + i * 120 + v(i) * 40} cy={24 + v(i + 2) * 14} rx="13" ry="5" />
        </g>
      ))}
      {kind === "hood" ? (
        <g>
          {/* Back row of buildings */}
          {Array.from({ length: 12 }, (_, i) => {
            const bh = 22 + v(i + 9) * 30;
            return <rect key={"b" + i} x={i * 22 - 4} y={96 - bh} width="19" height={bh} fill={color} opacity="0.26" rx="1.5" />;
          })}
          {/* Ground */}
          <rect y="96" width="252" height="22" fill="#DDD8C8" />
          <rect y="96" width="252" height="3" fill={color} opacity="0.25" />
          {/* Front row with lit windows */}
          {Array.from({ length: 7 }, (_, i) => {
            const bh = 32 + v(i) * 42;
            const bx = 2 + i * 36, by = 104 - bh;
            const floors = Math.max(2, Math.floor(bh / 15));
            return (
              <g key={"f" + i}>
                <rect x={bx} y={by} width="30" height={bh} rx="2" fill={color} opacity={0.5 + 0.18 * v(i + 4)} />
                {Array.from({ length: floors }, (_, r) => (
                  <g key={r} fill="#FFF6DF" opacity="0.95">
                    <rect x={bx + 6} y={by + 7 + r * 14} width="5" height="7" rx="0.8" />
                    <rect x={bx + 18} y={by + 7 + r * 14} width="5" height="7" rx="0.8" />
                  </g>
                ))}
              </g>
            );
          })}
          {/* A street tree */}
          <g transform={`translate(${30 + v(6) * 180},0)`}>
            <rect x="-1.5" y="88" width="3" height="12" fill="#7A5C44" />
            <circle cx="0" cy="84" r="8" fill="#6E9C5F" />
            <circle cx="5" cy="88" r="5" fill="#5F8A52" />
          </g>
        </g>
      ) : (
        <g>
          {/* Hills */}
          <path d={`M0,${84 - v(1) * 14} Q63,${60 - v(2) * 16} 126,${80 - v(3) * 10} T252,${76 - v(4) * 12} L252,118 L0,118 Z`} fill={color} opacity="0.3" />
          <path d={`M0,${98 - v(5) * 8} Q84,${84 - v(6) * 10} 168,${96 - v(7) * 8} T252,94 L252,118 L0,118 Z`} fill={color} opacity="0.48" />
          {/* Winding path */}
          <path d={`M${20 + v(8) * 40},118 Q${70 + v(9) * 40},100 ${120 + v(10) * 60},104 T232,92`} fill="none" stroke="#F2EDDD" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
          {/* Pond */}
          <g transform={`translate(${60 + v(11) * 110},${102 + v(12) * 6})`}>
            <ellipse rx="30" ry="8" fill="#8FB8D4" />
            <ellipse cx="-7" cy="-2" rx="12" ry="2.6" fill="#FFFFFF" opacity="0.45" />
          </g>
          {/* Trees */}
          {Array.from({ length: 6 }, (_, i) => {
            const tx = 18 + i * 42 + v(i) * 16, ty = 88 - v(i + 2) * 16;
            const s = 0.8 + v(i + 5) * 0.5;
            return (
              <g key={i} transform={`translate(${tx},${ty}) scale(${s})`}>
                <rect x="-1.8" y="0" width="3.6" height="14" fill="#7A5C44" />
                <circle cx="0" cy="-8" r="9" fill="#6E9C5F" />
                <circle cx="-6" cy="-3" r="6" fill="#5F8A52" />
                <circle cx="6" cy="-4" r="6" fill="#7CA86B" />
              </g>
            );
          })}
          {/* Birds */}
          {[0, 1].map((i) => (
            <path key={"bird" + i} d={`M${90 + i * 34 + v(i) * 30},${30 + v(i + 3) * 12} q3,-3.5 6,0 q3,-3.5 6,0`} fill="none" stroke="#5A5A60" strokeWidth="1.4" strokeLinecap="round" />
          ))}
        </g>
      )}
    </svg>
  );
}

export const TAG_OPTIONS = ["leafy", "edgy", "vibey", "busy", "quiet", "villagey", "posh", "gritty", "arty", "foodie", "riverside", "cool buildings", "market day", "nightlife", "hidden gem"];

export {
  HOODS, GREENS, AREA_COLORS, AREA_ORDER, STATE_LABEL, PLACES,
  HOOD_CELLS, GREEN_SHAPES, THAMES_PATH, BASE_WATER, ROAD_PATHS,
  W, H, Postcard,
};
