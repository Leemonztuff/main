
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get args safely
const args = process['argv'] || [];
const VERIFY_ONLY = args.includes('--verify');

// --- REMOTE SOURCES ---
// Using GitHub Raw directly to avoid redirection issues
const REMOTE_WESNOTH_URL = "https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/images";
const REMOTE_MC_URL = "https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.19.3/assets/minecraft/textures/block";

// --- ASSETS LIST ---
const ASSETS_TO_DOWNLOAD = [
    'units/human-loyalists/lieutenant.png', 'units/human-loyalists/swordsman.png', 'units/human-magi/red-mage.png',
    'units/human-outlaws/thief.png', 'units/human-magi/white-mage.png', 'units/human-outlaws/thug.png',
    'units/human-loyalists/fencer.png', 'units/elves-wood/shaman.png', 'units/human-loyalists/paladin.png',
    'units/human-loyalists/huntsman.png', 'units/human-magi/silver-mage.png', 'units/human-magi/dark-adept.png',
    'units/elves-wood/hero.png', 'units/elves-wood/archer.png', 'units/elves-wood/fighter.png',
    'units/dwarves/steelclad.png', 'units/dwarves/guardsman.png', 'units/dwarves/fighter.png',
    'units/human-outlaws/footpad.png', 'units/drakes/fighter.png', 'units/dwarves/thunderer.png',
    'units/undead-necromancers/dark-sorcerer.png', 'units/orcs/warrior.png', 'units/goblins/spearman.png',
    'units/orcs/grunt.png', 'units/orcs/archer.png', 'units/undead-skeletal/skeleton.png',
    'units/undead-skeletal/archer.png', 'units/undead/walking-corpse.png', 'units/monsters/wolf.png',
    'units/monsters/vampire-bat.png', 'units/monsters/mudcrawler.png', 'units/undead/ghoul.png',
    'units/undead-necromancers/ancient-lich.png', 'units/monsters/giant-spider.png', 'units/trolls/whelp.png',
    'units/monsters/cuttlefish.png', 'units/undead-spirit/shadow.png',
    'terrain/grass/green.png', 'terrain/grass/semi-dry.png', 'terrain/grass/dry.png', 'terrain/frozen/snow.png',
    'terrain/water/coast.png', 'terrain/flat/dirt.png', 'terrain/sand/desert.png', 'terrain/swamp/water-tile.png',
    'terrain/mountains/basic.png', 'terrain/village/human-cottage.png', 'terrain/cave/floor.png',
    'terrain/cave/fungus-tile.png', 'terrain/chasm/lava.png', 'terrain/chasm/earthy.png', 'terrain/path/cobble.png',
    'terrain/path/dirt.png', 'terrain/interior/wooden.png', 'terrain/interior/stone.png', 'terrain/walls/stone.png',
    'terrain/cave/wall.png', 
    'terrain/forest/pine-tile.png', 'terrain/forest/deciduous-summer-tile.png', 'terrain/forest/rainforest-tile.png',
    'terrain/forest/snow-forest-tile.png', 'terrain/mountains/basic-tile.png', 'terrain/mountains/dry-tile.png',
    'terrain/village/human-city-tile.png', 'terrain/castle/castle.png', 'terrain/castle/ruin.png',
    'terrain/castle/outside-dwarven/dwarven-keep-tile.png', 'scenery/summoning-center.png',
    'items/potion-red.png', 'items/potion-blue.png', 'items/potion-orange.png', 'items/holy-water.png',
    'items/grain-sheaf.png', 'items/sword.png', 'items/dagger.png', 'items/bow.png', 'items/staff.png',
    'items/shield.png', 'items/armor.png', 'items/armor-golden.png', 'items/sword-flaming.png',
    'items/sword-holy.png', 'items/gem-large-blue.png',
    'attacks/battleaxe.png', 'attacks/mace.png', 'attacks/saber-human.png', 'attacks/claws-undead.png',
    'attacks/sword-human.png', 'attacks/spear.png', 'attacks/fireball.png', 'attacks/iceball.png',
    'attacks/lightning.png', 'attacks/fang.png', 'attacks/slime.png', 'attacks/dark-missile.png',
    'attacks/lightbeam.png', 'attacks/magic-missile.png', 'attacks/touch-zombie.png',
    'projectiles/fireball-n.png', 'projectiles/ice-n.png', 'projectiles/missile-n.png',
    'projectiles/lightning-n.png', 'projectiles/magic-missile-n.png', 'projectiles/whitemissile-n.png',
    'projectiles/darkmissile-n.png', 'projectiles/fire-burst-small-1.png', 'projectiles/fire-burst-small-2.png',
    'projectiles/fire-burst-small-3.png', 'projectiles/fire-burst-small-4.png', 'halo/elven/druid-healing1.png',
    'halo/elven/druid-healing2.png', 'halo/elven/druid-healing3.png', 'halo/elven/druid-healing4.png',
    'halo/elven/druid-healing5.png', 'weather/rain-heavy.png'
];

const MINECRAFT_ASSETS = [
    'grass_block_top.png', 'blue_concrete.png', 'stone.png', 'sand.png', 'stone_bricks.png',
    'lava_still.png', 'mycelium_top.png', 'oak_planks.png', 'cobblestone.png', 'podzol_top.png',
    'snow.png', 'mossy_cobblestone.png', 'black_concrete.png', 'bricks.png', 'fern.png',
    'poppy.png', 'brown_mushroom.png'
];

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

const checkUrl = (url) => {
    return new Promise((resolve) => {
        const req = https.request(url, { method: 'HEAD' }, (res) => resolve(res.statusCode === 200));
        req.on('error', () => resolve(false));
        req.end();
    });
};

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(true); });
            } else {
                fs.unlink(dest, () => {});
                reject(`HTTP ${response.statusCode}`);
            }
        }).on('error', (err) => {
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
    
    // 1. WESNOTH ASSETS
    console.log(`[Wesnoth] Checking ${ASSETS_TO_DOWNLOAD.length} core assets...`);
    for (const assetPath of ASSETS_TO_DOWNLOAD) {
        const dest = path.join('public', 'assets', 'wesnoth', assetPath);
        
        let needsDownload = !fs.existsSync(dest);
        if (!needsDownload) {
            const stats = fs.statSync(dest);
            if (stats.size === 0) needsDownload = true;
        }

        if (needsDownload) {
            if (!VERIFY_ONLY) {
                try {
                    await downloadFile(`${REMOTE_WESNOTH_URL}/${assetPath}`, dest);
                    process['stdout'].write('.');
                    successCount++;
                } catch (e) { console.warn(`\nFailed: ${assetPath}`); }
            }
        } else { successCount++; }
    }
    console.log(`\nVerified/Downloaded Wesnoth assets.`);

    // 2. MINECRAFT ASSETS
    console.log(`\n[Minecraft] Checking ${MINECRAFT_ASSETS.length} 3D textures...`);
    for (const assetFile of MINECRAFT_ASSETS) {
        const dest = path.join('public', 'assets', 'minecraft', assetFile);
        let needsDownload = !fs.existsSync(dest);
        if (!needsDownload) {
            const stats = fs.statSync(dest);
            if (stats.size === 0) needsDownload = true;
        }

        if (needsDownload) {
            if (!VERIFY_ONLY) {
                try {
                    await downloadFile(`${REMOTE_MC_URL}/${assetFile}`, dest);
                    process['stdout'].write('.');
                    successCount++;
                } catch (e) { console.warn(`\nFailed: ${assetFile}`); }
            }
        } else { successCount++; }
    }

    // 3. CLASS ICONS COPY
    console.log(`\n\n[Icons] Generating Class Icons...`);
    const iconDir = path.join('public', 'assets', 'classicon');
    if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });

    for (const [filename, sourcePath] of Object.entries(CLASS_ICON_MAP)) {
        const destFile = path.join(iconDir, filename);
        let needsCreation = !fs.existsSync(destFile);
        if (!needsCreation) {
            const stats = fs.statSync(destFile);
            if (stats.size === 0) needsCreation = true;
        }

        if (!needsCreation) {
            console.log(`   ✅ ${filename} exists.`);
        } else {
            if (!VERIFY_ONLY) {
                const sourceFile = path.join('public', 'assets', 'wesnoth', sourcePath);
                // Verify source exists AND has content before copying
                if (fs.existsSync(sourceFile) && fs.statSync(sourceFile).size > 0) {
                    fs.copyFileSync(sourceFile, destFile);
                    console.log(`   Created: ${filename}`);
                } else {
                    console.warn(`   ❌ Missing Source: ${sourcePath} (Download might have failed)`);
                }
            } else {
                console.warn(`   ❌ Missing: ${filename}`);
            }
        }
    }

    console.log("\n=========================================================");
    console.log("DIAGNOSTIC COMPLETE");
    console.log("If icons still fail: 1. Delete 'public/assets' 2. Run 'node download_assets.mjs'");
    console.log("=========================================================");
};

run();
