
import { HexCell, TerrainType, WeatherType, Dimension } from '../types';
import { useContentStore } from '../store/contentStore';

// --- NOISE MATH HELPERS ---
class Mulberry32 {
    private a: number;
    constructor(seed: number) { this.a = seed; }
    next(): number {
        var t = this.a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// Simplex-ish Noise Implementation
const PERM = new Uint8Array(512);
const GRAD3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];

const seedNoise = (seed: number) => {
    const rng = new Mulberry32(seed);
    const p = new Uint8Array(256);
    for(let i=0; i<256; i++) p[i] = i;
    for(let i=0; i<256; i++) {
        const r = Math.floor(rng.next() * 256);
        const temp = p[i]; p[i] = p[r]; p[r] = temp;
    }
    for(let i=0; i<512; i++) PERM[i] = p[i & 255];
};

const dot = (g: number[], x: number, y: number) => g[0]*x + g[1]*y;

const noise2D = (xin: number, yin: number): number => {
    let n0, n1, n2;
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if(x0 > y0) { i1=1; j1=0; } else { i1=0; j1=1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = PERM[ii+PERM[jj]] % 12;
    const gi1 = PERM[ii+i1+PERM[jj+j1]] % 12;
    const gi2 = PERM[ii+1+PERM[jj+1]] % 12;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if(t0<0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * dot(GRAD3[gi0], x0, y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if(t1<0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * dot(GRAD3[gi1], x1, y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if(t2<0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * dot(GRAD3[gi2], x2, y2); }
    return 70.0 * (n0 + n1 + n2);
};

// Fractal Brownian Motion (Octaves for detail)
const fbm = (x: number, y: number, octaves: number, persistence: number = 0.5, lacunarity: number = 2): number => {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for(let i=0; i<octaves; i++) {
        total += noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
};

// --- CANONICAL NAMING SYSTEM ---

const LOCATION_NAMES = {
    [TerrainType.FOREST]: [
        'Neverwinter Wood', 'The High Forest', 'Cormanthor', 'The Dire Wood', 'Spiderhaunt', 
        'Elven Court', 'Mistwood', 'The Border Forest', 'Hullack Forest', 'Lethyr'
    ],
    [TerrainType.JUNGLE]: [
        'Chult', 'The Black Jungles', 'Mhair Jungles', 'Veldorn', 'The Savage Coast'
    ],
    [TerrainType.MOUNTAIN]: [
        'The Spine of the World', 'The Cloud Peaks', 'Nether Mountains', 'Storm Horns', 
        'The Thunder Peaks', 'Earthspur', 'Galena Mountains', 'The Star Mounts'
    ],
    [TerrainType.SWAMP]: [
        'The Mere of Dead Men', 'Foulmere', 'Lizard Marsh', 'The Farsea Marshes', 'Vast Swamp', 'Chelimber'
    ],
    [TerrainType.DESERT]: [
        'Anauroch', 'The Calim Desert', 'The Shaar', 'Raurin', 'The Dust', 'Saiyaddar'
    ],
    [TerrainType.TUNDRA]: [
        'Icewind Dale', 'The Great Glacier', 'Reghed Glacier', 'The Frozenfar', 'Endless Ice'
    ],
    [TerrainType.TAIGA]: [
        'The Cold Wood', 'The Silver Marches', 'Luruar', 'Adbar'
    ],
    [TerrainType.BADLANDS]: [
        'The Goblin Marches', 'Thar', 'The Ride', 'Tortured Lands'
    ],
    [TerrainType.WASTELAND]: [
        'The Plaguelands', 'Mournland', 'The Scar', 'Dead Lands'
    ],
    // Shadow Realm Names
    [TerrainType.FUNGUS]: ['The Underdark', 'Menzoberranzan', 'Blingdenstone', 'Gracklstugh'],
    [TerrainType.LAVA]: ['The Abyss', 'Nine Hells', 'Lake of Fire', 'Mount Doom'],
    [TerrainType.CHASM]: ['The Void', 'Shadowfell', 'Ravenloft', 'The Great Rift']
};

const GENERIC_PREFIXES = ['North', 'South', 'East', 'West', 'High', 'Low', 'Old', 'New', 'Dark', 'Light'];
const GENERIC_SUFFIXES = ['Lands', 'Reach', 'Expanse', 'Valley', 'Fields', 'Plains', 'Wilds'];

const getZoneName = (seed: number, terrain: TerrainType, dimension: Dimension): string => {
    const rng = new Mulberry32(seed);
    
    // Check specific lists first
    const specificList = LOCATION_NAMES[terrain as keyof typeof LOCATION_NAMES];
    
    if (specificList && specificList.length > 0) {
        // Use a unique name from the list based on seed
        return specificList[Math.floor(rng.next() * specificList.length)];
    }

    // Generic fallback construction
    if (dimension === Dimension.UPSIDE_DOWN) {
        return `Shadow of ${GENERIC_SUFFIXES[Math.floor(rng.next() * GENERIC_SUFFIXES.length)]}`;
    }

    const prefix = GENERIC_PREFIXES[Math.floor(rng.next() * GENERIC_PREFIXES.length)];
    const suffix = GENERIC_SUFFIXES[Math.floor(rng.next() * GENERIC_SUFFIXES.length)];
    
    return `The ${prefix} ${suffix}`;
};

// --- BIOME DETERMINATION (TRIANGULAR CHART) ---

const getBiome = (elevation: number, moisture: number, temperature: number, dimension: Dimension): { terrain: TerrainType, weather: WeatherType } => {
    let terrain = TerrainType.GRASS;
    let weather = WeatherType.NONE;

    if (dimension === Dimension.NORMAL) {
        // --- NORMAL WORLD: D&D BIOME CHART LOGIC ---
        if (elevation < -0.3) return { terrain: TerrainType.WATER, weather };

        if (elevation > 0.65) {
            return { terrain: TerrainType.MOUNTAIN, weather: temperature < 0 ? WeatherType.SNOW : WeatherType.NONE };
        }

        if (temperature < -0.5) return { terrain: TerrainType.TUNDRA, weather: WeatherType.SNOW };
        if (temperature < -0.2) return { terrain: TerrainType.TAIGA, weather: WeatherType.SNOW };

        if (temperature < 0.3) {
            if (moisture > 0.4) return { terrain: TerrainType.FOREST, weather };
            if (moisture > -0.2) return { terrain: TerrainType.GRASS, weather };
            return { terrain: TerrainType.PLAINS, weather }; 
        }

        if (temperature >= 0.3) {
            if (moisture > 0.5) return { terrain: TerrainType.JUNGLE, weather }; 
            if (moisture > 0) return { terrain: TerrainType.SAVANNAH, weather }; 
            if (moisture > -0.4) return { terrain: TerrainType.WASTELAND, weather }; 
            return { terrain: TerrainType.DESERT, weather }; 
        }

    } else {
        // --- UPSIDE DOWN LOGIC ---
        if (elevation < -0.2) return { terrain: TerrainType.CHASM, weather: WeatherType.ASH }; 
        if (elevation > 0.6) return { terrain: TerrainType.LAVA, weather: WeatherType.ASH }; 

        if (moisture > 0.3) return { terrain: TerrainType.FUNGUS, weather: WeatherType.FOG };
        else if (moisture < -0.3) return { terrain: TerrainType.CAVE_FLOOR, weather: WeatherType.ASH };
        else return { terrain: TerrainType.BADLANDS, weather: WeatherType.FOG };
    }
    
    return { terrain, weather };
};

export class WorldGenerator {
    private static isInitialized = false;
    private static seed = 12345;

    static init(seed: number) {
        this.seed = seed;
        seedNoise(seed);
        this.isInitialized = true;
    }

    static getTile(q: number, r: number, dimension: Dimension): HexCell {
        if (!this.isInitialized) this.init(12345);

        // ACCESS DYNAMIC CONFIG
        const config = useContentStore.getState().gameConfig || { mapScale: 0.12, moistureOffset: 150, tempOffset: 300 };
        
        // Scale coordinates for noise (use dynamic mapScale)
        const scale = config.mapScale; 
        const x = (q * Math.sqrt(3) + r * Math.sqrt(3)/2) * scale;
        const y = (r * 3/2) * scale;

        // 1. GENERATE NOISE MAPS (Offsets from Config)
        const elevation = fbm(x, y, 4, 0.5, 2.0); 
        const moisture = fbm(x + config.moistureOffset, y + 67.89, 3, 0.5, 2.0);
        
        const latitudeFactor = 1 - Math.abs(r) / 50; 
        const tempNoise = noise2D(x * 0.5 - config.tempOffset, y * 0.5);
        const temperature = (latitudeFactor * 1.5 - 0.5) + (tempNoise * 0.4); 

        // 2. DETERMINE BIOME
        const { terrain, weather } = getBiome(elevation, moisture, temperature, dimension);

        // 3. REGION NAMING (PROVINCES)
        // Group tiles into large hex clusters (radius ~15) for naming stability
        // We use a simplified coordinate quantization for "Provinces"
        const PROVINCE_SIZE = 15;
        // Convert axial to rough cartesian for grid snapping
        const provinceX = Math.round(q / PROVINCE_SIZE);
        const provinceY = Math.round(r / PROVINCE_SIZE);
        const provinceSeed = (provinceX * 73856093) ^ (provinceY * 19349663) ^ this.seed;
        
        // Sample center of province to determine dominant biome for naming
        // This ensures the name matches the "feel" of the area roughly
        const pCenterX = provinceX * PROVINCE_SIZE;
        const pCenterY = provinceY * PROVINCE_SIZE;
        
        // Recalculate biome at province center for naming consistency
        const px = (pCenterX * Math.sqrt(3) + pCenterY * Math.sqrt(3)/2) * scale;
        const py = (pCenterY * 3/2) * scale;
        const pElev = fbm(px, py, 4, 0.5, 2.0);
        const pMoist = fbm(px + config.moistureOffset, py + 67.89, 3, 0.5, 2.0);
        const pLat = 1 - Math.abs(pCenterY) / 50;
        const pTempNoise = noise2D(px * 0.5 - config.tempOffset, py * 0.5);
        const pTemp = (pLat * 1.5 - 0.5) + (pTempNoise * 0.4);
        const { terrain: provinceTerrain } = getBiome(pElev, pMoist, pTemp, dimension);

        // Generate Name based on Province terrain
        const regionName = getZoneName(provinceSeed, provinceTerrain, dimension);

        // 4. GENERATE POIs (Points of Interest)
        const rng = new Mulberry32(q * 73856093 ^ r * 19349663 ^ this.seed);
        
        let structureType: TerrainType | null = null;
        let hasPortal = false;
        let hasEncounter = false;
        let poiType: HexCell['poiType'] = undefined;

        const isSafeLand = terrain !== TerrainType.WATER && terrain !== TerrainType.MOUNTAIN && terrain !== TerrainType.LAVA && terrain !== TerrainType.CHASM;
        
        if (isSafeLand) {
            // Chunk based spawning for towns
            const chunkQ = Math.floor(q / 10);
            const chunkR = Math.floor(r / 10);
            
            const chunkRng = new Mulberry32(chunkQ * 1234 ^ chunkR * 5678 ^ this.seed);
            const spotQ = chunkQ * 10 + Math.floor(chunkRng.next() * 10);
            const spotR = chunkR * 10 + Math.floor(chunkRng.next() * 10);

            if (q === spotQ && r === spotR) {
                const roll = chunkRng.next();
                if (dimension === Dimension.NORMAL) {
                    if (roll > 0.7) {
                        structureType = roll > 0.9 ? TerrainType.CASTLE : TerrainType.VILLAGE;
                    }
                    else if (roll > 0.5) structureType = TerrainType.RUINS;
                    else if (roll > 0.4) poiType = 'TEMPLE'; 
                } else {
                    if (roll > 0.5) structureType = TerrainType.RUINS;
                }
            }

            if (q === 0 && r === 0) {
                structureType = dimension === Dimension.NORMAL ? TerrainType.CASTLE : TerrainType.RUINS;
            }

            if (rng.next() < 0.003) hasPortal = true;

            const distFromCenter = Math.sqrt(q*q + r*r);
            if (distFromCenter > 5) {
                const dangerLevel = (dimension === Dimension.UPSIDE_DOWN ? 0.2 : 0.05);
                if (rng.next() < dangerLevel) hasEncounter = true;
            }
        }

        let finalTerrain = terrain;
        if (structureType) {
            finalTerrain = structureType;
        }

        if (structureType === TerrainType.CASTLE || structureType === TerrainType.VILLAGE) {
            poiType = 'PLAZA';
        }

        return {
            q, r,
            terrain: finalTerrain,
            weather,
            isExplored: false,
            isVisible: false,
            hasPortal,
            poiType,
            hasEncounter,
            regionName
        };
    }
}
