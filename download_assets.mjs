
// ... keep imports ...
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- REMOTE SOURCES (UPDATED TO JSDELIVR) ---
const REMOTE_WESNOTH_URL = "https://cdn.jsdelivr.net/gh/wesnoth/wesnoth@master/data/core/images";
const REMOTE_MC_URL = "https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.19.3/assets/minecraft/textures/block";

// --- ASSET DEFINITIONS (Mirrors constants.ts) ---
const ASSETS_TO_DOWNLOAD = [
    // --- UNITS ---
    // Classes
    'units/human-loyalists/lieutenant.png', 
    'units/human-loyalists/swordsman.png',
    'units/human-magi/red-mage.png',
    'units/human-outlaws/thief.png',
    'units/human-magi/white-mage.png',
    'units/human-outlaws/thug.png',
    'units/human-loyalists/fencer.png',
    'units/elves-wood/shaman.png',
    'units/human-loyalists/paladin.png',
    'units/human-loyalists/huntsman.png',
    'units/human-magi/silver-mage.png',
    'units/human-magi/dark-adept.png',
    // Races
    'units/elves-wood/hero.png',
    'units/elves-wood/archer.png',
    'units/elves-wood/fighter.png',
    'units/dwarves/steelclad.png',
    'units/dwarves/guardsman.png',
    'units/dwarves/fighter.png',
    'units/human-outlaws/footpad.png',
    'units/drakes/fighter.png',
    'units/dwarves/thunderer.png',
    'units/undead-necromancers/dark-sorcerer.png',
    'units/orcs/warrior.png',
    // Enemies
    'units/goblins/spearman.png',
    'units/orcs/grunt.png',
    'units/orcs/archer.png',
    'units/undead-skeletal/skeleton.png',
    'units/undead-skeletal/archer.png',
    'units/undead/walking-corpse.png',
    'units/monsters/wolf.png',
    'units/monsters/vampire-bat.png',
    'units/monsters/mudcrawler.png',
    'units/undead/ghoul.png',
    'units/undead-necromancers/ancient-lich.png',

    // --- TERRAIN & TILES ---
    'terrain/grass/green.png',
    'terrain/grass/semi-dry.png',
    'terrain/grass/dry.png',
    'terrain/frozen/snow.png',
    'terrain/water/coast.png',
    'terrain/flat/dirt.png',
    'terrain/sand/desert.png',
    'terrain/swamp/water-tile.png',
    'terrain/mountains/basic.png',
    'terrain/village/human-cottage.png',
    'terrain/cave/floor.png',
    'terrain/cave/fungus-tile.png',
    'terrain/chasm/lava.png',
    'terrain/chasm/earthy.png',
    'terrain/path/cobble.png',
    'terrain/path/dirt.png',
    'terrain/interior/wooden.png',
    'terrain/interior/stone.png',
    'terrain/walls/stone.png',

    // --- OVERLAYS ---
    'terrain/forest/pine-tile.png',
    'terrain/forest/deciduous-summer-tile.png',
    'terrain/forest/rainforest-tile.png',
    'terrain/forest/snow-forest-tile.png',
    'terrain/mountains/basic-tile.png',
    'terrain/mountains/dry-tile.png',
    'terrain/village/human-city-tile.png', 
    'terrain/castle/castle.png', 
    'terrain/castle/ruin.png', 
    'terrain/castle/outside-dwarven/dwarven-keep-tile.png',
    'scenery/summoning-center.png', // Added for Portal overlay

    // --- ITEMS & ICONS ---
    'items/potion-red.png',
    'items/potion-blue.png',
    'items/potion-orange.png',
    'items/holy-water.png',
    'items/grain-sheaf.png',
    'items/sword.png',
    'items/dagger.png',
    'items/bow.png',
    'items/staff.png',
    'items/shield.png',
    'items/armor.png',
    'items/armor-golden.png',
    'items/sword-flaming.png',
    'items/sword-holy.png',
    'items/gem-large-blue.png', // Added for Logo
    'attacks/battleaxe.png',
    'attacks/mace.png',
    'attacks/saber-human.png',
    'attacks/claws-undead.png',

    // --- VFX & PROJECTILES ---
    'projectiles/fireball-n.png',
    'projectiles/ice-n.png',
    'projectiles/missile-n.png',
    'projectiles/lightning-n.png',
    'projectiles/magic-missile-n.png',
    'projectiles/whitemissile-n.png',
    'projectiles/darkmissile-n.png',
    'projectiles/fire-burst-small-1.png',
    'projectiles/fire-burst-small-2.png',
    'projectiles/fire-burst-small-3.png',
    'projectiles/fire-burst-small-4.png',
    'halo/elven/druid-healing1.png',
    'halo/elven/druid-healing2.png',
    'halo/elven/druid-healing3.png',
    'halo/elven/druid-healing4.png',
    'halo/elven/druid-healing5.png',
    'weather/rain-heavy.png',
];

const MINECRAFT_ASSETS = [
    'grass_block_top.png',
    'blue_concrete.png',
    'stone.png',
    'sand.png',
    'stone_bricks.png',
    'lava_still.png',
    'mycelium_top.png',
    'oak_planks.png',
    'cobblestone.png',
    'podzol_top.png',
    'snow.png',
    'mossy_cobblestone.png',
    'black_concrete.png',
    'bricks.png',
    'fern.png',
    'poppy.png',
    'brown_mushroom.png'
];

// --- DOWNLOAD UTILITY ---
const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const file = fs.createWriteStream(dest);
        const request = https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(true);
                });
            } else {
                fs.unlink(dest, () => {}); // Delete empty file
                if (response.statusCode === 404) {
                    console.warn(`[404] Missing: ${url}`);
                    resolve(false); // Resolve but warn
                } else {
                    reject(`Server responded with ${response.statusCode}: ${url}`);
                }
            }
        });

        request.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err.message);
        });
    });
};

const run = async () => {
    console.log("---------------------------------------------------------");
    console.log("   EPIC EARTH TACTICS: ASSET DOWNLOADER");
    console.log("---------------------------------------------------------");
    console.log("Fetching graphic assets to /public/assets/ ...");

    let successCount = 0;
    let failCount = 0;

    // 1. Download Wesnoth Assets
    for (const assetPath of ASSETS_TO_DOWNLOAD) {
        const url = `${REMOTE_WESNOTH_URL}/${assetPath}`;
        const dest = path.join('public', 'assets', 'wesnoth', assetPath);
        
        try {
            const success = await downloadFile(url, dest);
            if (success) {
                successCount++;
                // process.stdout.write('.');
            } else {
                failCount++;
            }
        } catch (e) {
            console.error(`Error downloading ${assetPath}:`, e);
            failCount++;
        }
    }

    // 2. Download Minecraft Assets
    for (const assetFile of MINECRAFT_ASSETS) {
        const url = `${REMOTE_MC_URL}/${assetFile}`;
        const dest = path.join('public', 'assets', 'minecraft', assetFile);
        
        try {
            const success = await downloadFile(url, dest);
            if (success) {
                successCount++;
                // process.stdout.write('.');
            } else {
                failCount++;
            }
        } catch (e) {
            console.error(`Error downloading ${assetFile}:`, e);
            failCount++;
        }
    }

    console.log("\n---------------------------------------------------------");
    console.log(`Download Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log("Assets are ready for local use.");
    console.log("---------------------------------------------------------");
};

run();
