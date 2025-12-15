import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use global process object
const VERIFY_ONLY = process.argv.includes('--verify');

// --- REMOTE SOURCES ---
// Using jsDelivr for reliable CDN access to GitHub repos
const REMOTE_WESNOTH_URL = "https://cdn.jsdelivr.net/gh/wesnoth/wesnoth@master/data/core/images";
// Minecraft assets from 1.19.3
const REMOTE_MC_URL = "https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.19.3/assets/minecraft/textures/block";

// --- ASSET DEFINITIONS ---
const ASSETS_TO_DOWNLOAD = [
    // --- UNITS ---
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
    'units/monsters/giant-spider.png',
    'units/trolls/whelp.png',
    'units/monsters/cuttlefish.png',
    'units/undead/shadow.png', // Shadow Stalker

    // --- TERRAIN ---
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
    'scenery/summoning-center.png', 

    // --- ITEMS ---
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
    'items/gem-large-blue.png',
    
    // --- ATTACKS ---
    'attacks/battleaxe.png',
    'attacks/mace.png',
    'attacks/saber-human.png',
    'attacks/claws-undead.png',
    'attacks/sword-human.png',
    'attacks/spear.png',
    'attacks/fireball.png',
    'attacks/iceball.png',
    'attacks/lightning.png',
    'attacks/fang.png',
    'attacks/slime.png',
    'attacks/dark-missile.png',
    'attacks/lightbeam.png',
    'attacks/magic-missile.png',
    'attacks/touch-zombie.png',

    // --- VFX ---
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

// Mapping for Class Icons (Fallback generation)
const CLASS_ICON_MAP = {
    'fighter.png': 'units/human-loyalists/swordsman.png',
    'ranger.png': 'units/human-loyalists/huntsman.png',
    'wizard.png': 'units/human-magi/red-mage.png',
    'cleric.png': 'units/human-magi/white-mage.png',
    'rogue.png': 'units/human-outlaws/thief.png',
    'barbarian.png': 'units/human-outlaws/thug.png',
    'paladin.png': 'units/human-loyalists/paladin.png',
    'sorcerer.png': 'units/human-magi/silver-mage.png',
    'warlock.png': 'units/human-magi/dark-adept.png',
    'druid.png': 'units/elves-wood/shaman.png',
    'bard.png': 'units/human-loyalists/fencer.png'
};

// --- DOWNLOAD UTILITY ---
const checkUrl = (url) => {
    return new Promise((resolve) => {
        const req = https.request(url, { method: 'HEAD' }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
};

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
                fs.unlink(dest, () => {});
                reject(`HTTP ${response.statusCode}`);
            }
        });

        request.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err.message);
        });
    });
};

const run = async () => {
    console.log("=========================================================");
    console.log(`   EPIC EARTH TACTICS: ASSET MANAGER ${VERIFY_ONLY ? '(VERIFY MODE)' : ''}`);
    console.log("=========================================================\n");

    let successCount = 0;
    let failCount = 0;
    let missingAssets = [];

    // 1. Process Wesnoth Assets
    console.log(`[Wesnoth] Processing ${ASSETS_TO_DOWNLOAD.length} assets...`);
    for (const assetPath of ASSETS_TO_DOWNLOAD) {
        const url = `${REMOTE_WESNOTH_URL}/${assetPath}`;
        const dest = path.join('public', 'assets', 'wesnoth', assetPath);
        
        if (VERIFY_ONLY) {
            const exists = await checkUrl(url);
            if (exists) {
                successCount++;
            } else {
                console.warn(`❌ MISSING: ${assetPath}`);
                missingAssets.push(url);
                failCount++;
            }
        } else {
            try {
                await downloadFile(url, dest);
                successCount++;
            } catch (e) {
                console.warn(`❌ FAILED: ${assetPath} (${e})`);
                missingAssets.push(url);
                failCount++;
            }
        }
    }

    // 2. Process Minecraft Assets
    console.log(`\n[Minecraft] Processing ${MINECRAFT_ASSETS.length} assets...`);
    for (const assetFile of MINECRAFT_ASSETS) {
        const url = `${REMOTE_MC_URL}/${assetFile}`;
        const dest = path.join('public', 'assets', 'minecraft', assetFile);
        
        if (VERIFY_ONLY) {
            const exists = await checkUrl(url);
            if (exists) {
                successCount++;
            } else {
                console.warn(`❌ MISSING: ${assetFile}`);
                missingAssets.push(url);
                failCount++;
            }
        } else {
            try {
                await downloadFile(url, dest);
                successCount++;
            } catch (e) {
                console.warn(`❌ FAILED: ${assetFile} (${e})`);
                missingAssets.push(url);
                failCount++;
            }
        }
    }

    // 3. GENERATE CLASS ICONS (Localization Fix)
    if (!VERIFY_ONLY) {
        console.log(`\n[Icons] Checking Class Icons in /public/assets/classicon/...`);
        const iconDir = path.join('public', 'assets', 'classicon');
        if (!fs.existsSync(iconDir)) {
            fs.mkdirSync(iconDir, { recursive: true });
        }

        console.log(`[Info] If you have custom icons, place them in: public/assets/classicon/`);
        console.log(`       Filenames must correspond to classes (e.g., fighter.png, wizard.png)`);

        for (const [filename, sourcePath] of Object.entries(CLASS_ICON_MAP)) {
            const destFile = path.join(iconDir, filename);
            
            // CRITICAL FIX: Do NOT overwrite if the user has placed their own file there
            if (fs.existsSync(destFile)) {
                // console.log(`  -> Skipping ${filename} (Already exists)`);
                continue;
            }

            const sourceFile = path.join('public', 'assets', 'wesnoth', sourcePath);
            try {
                if (fs.existsSync(sourceFile)) {
                    fs.copyFileSync(sourceFile, destFile);
                    console.log(`  -> Generated ${filename} (Fallback from Wesnoth)`);
                } else {
                    console.warn(`  ⚠️ Source missing for fallback ${filename}: ${sourcePath}`);
                }
            } catch (e) {
                console.error(`  ❌ Error generating ${filename}:`, e);
            }
        }
    }

    console.log("\n=========================================================");
    console.log(`SUMMARY:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed:  ${failCount}`);
    
    if (missingAssets.length > 0) {
        console.log("\n⚠️  MISSING ASSETS REPORT:");
        missingAssets.forEach(u => console.log(`   - ${u}`));
        console.log("\nTip: Check constants.ts for incorrect filenames.");
    }
    
    if (!VERIFY_ONLY && failCount === 0) {
        console.log("\nAll assets downloaded to /public/assets/");
        console.log("Class Icons check complete.");
    }
    console.log("=========================================================");
};

run();
