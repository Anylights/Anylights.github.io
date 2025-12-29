import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { FontLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://unpkg.com/three@0.160.0/examples/jsm/geometries/TextGeometry.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { vertexShader, fragmentShader } from './shaders.js';

// --- Configuration ---
const FONT_FAMILY = '"Azeret Mono", monospace';
const WORLD_SIZE = 16;
const MATCH_THRESHOLD = 3; // Number of keywords needed to unlock a project
const FIND_SENTENCE = 'Is this yourself in your mind?';
const DEBUG_FORCE_FINALE = false; // Set true to auto-run the finale for debugging

// --- Projects Data ---
// Projects are now loaded from individual project.json files in each project folder
let PROJECTS_DATA = [];

// List of project IDs to load
const PROJECT_IDS = [
    'avatar-zero',
    'mobius',
    'sparkle',
    'farewell',
    'midwest-emo-house',
    'the-place-where-wind-lives',
    'run-back-in-time',
    'faithfall',
    'syncsprite',
    'notes-of-hypnotist'
];

// Load all project data
async function loadProjectsData() {
    const promises = PROJECT_IDS.map(async (id) => {
        try {
            const response = await fetch(`assets/projects/${id}/project.json`);
            if (!response.ok) {
                console.warn(`Failed to load project: ${id}`);
                return null;
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error loading project ${id}:`, error);
            return null;
        }
    });

    const results = await Promise.all(promises);
    PROJECTS_DATA = results.filter(p => p !== null);
    console.log(`Loaded ${PROJECTS_DATA.length} projects`);

    // Initialize keywords and UI after loading
    initializeAfterProjectsLoad();
}

// Initialize the app after projects are loaded
function initializeAfterProjectsLoad() {
    // Rebuild keyword list from loaded projects
    const PROJECT_KEYWORDS = [...new Set(PROJECTS_DATA.flatMap(p => p.keywords))];
    const FILLER_KEYWORDS = [];

    // Update global KEYWORDS variable
    KEYWORDS = [...PROJECT_KEYWORDS, ...FILLER_KEYWORDS.filter(k => !PROJECT_KEYWORDS.includes(k))];

    console.log(`Initialized ${KEYWORDS.length} keywords:`, KEYWORDS);

    // Recreate keywords in scene
    keywordGroup.children.forEach(mesh => keywordGroup.remove(mesh));
    createKeywords();

    if (state.findYourself.pendingWords.length > 0) {
        const pending = state.findYourself.pendingWords.slice();
        state.findYourself.pendingWords = [];
        applyFindWordsToField(pending);
    }

    // Re-render gallery
    renderGallery();
    create3DGallery();
}

// Build keyword list - will be initialized after projects load
let KEYWORDS = [];

// --- State ---
const state = {
    view: 'field', // field, gallery, about, projectDetail
    fieldPhase: 'landing', // landing, shattering, active, unlocking, projectReveal, ending
    mouse: new THREE.Vector2(),
    targetMouse: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    collectedKeywords: [], // Array of mesh objects
    collectedWords: [], // Array of word strings (for tracking)
    lines: [],
    keys: { w: false, a: false, s: false, d: false, q: false, e: false, arrowleft: false, arrowright: false },
    velocity: new THREE.Vector3(),
    rotationVelocity: 0,
    pitchVelocity: 0, // For vertical rotation (Q/E)
    // Collection System
    collectedProjects: loadCollectedProjects(), // {projectId: {project, usedKeywords: []}}
    currentUnlockingProject: null, // Project being unlocked
    currentProjectDetail: null, // Project being viewed in detail
    finaleTriggered: false, // Only run finale once until reset
    helpShown: false,
    findYourself: {
        active: false,
        words: [],
        selectedWords: [],
        selectedMeshes: [],
        wordMeshes: {},
        inputWords: [],
        pendingWords: [],
        sequenceActive: false
    }
};

// Finale Sequence State
const finaleState = {
    active: false,
    spinning: false,
    spinAngle: 0,
    spinSpeed: 0,
    wordTimeline: null,
    overlay: null,
    particleSystem: null,
    messageOverlay: null
};

// Load collected projects from localStorage
function loadCollectedProjects() {
    try {
        const saved = localStorage.getItem('collectedProjects');
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        return {};
    }
}

// Save collected projects to localStorage
function saveCollectedProjects() {
    try {
        localStorage.setItem('collectedProjects', JSON.stringify(state.collectedProjects));
    } catch (e) {
        console.warn('Failed to save to localStorage');
    }
}

// Reset all collected projects
function resetCollectedProjects() {
    state.collectedProjects = {};
    state.collectedKeywords = [];
    state.collectedWords = [];
    state.finaleTriggered = false;
    state.helpShown = false;
    resetFindYourselfState();

    // Clear localStorage
    try {
        localStorage.removeItem('collectedProjects');
    } catch (e) {
        console.warn('Failed to clear localStorage');
    }

    // Reset UI
    updateBottomBar();
    renderGallery();
    create3DGallery();
    if (galleryGroup && state.view === 'gallery') {
        galleryGroup.visible = true;
    }

    // Reset keywords in scene
    keywordGroup.children.forEach(mesh => {
        mesh.userData.selected = false;
        mesh.userData.hovered = false;
        mesh.material.opacity = 0;
        mesh.material.color.setHex(0xffffff);
        mesh.position.copy(mesh.userData.originalPos);
    });

    // Reset lines
    state.lines.forEach(line => line.visible = false);

    // Return to landing
    state.fieldPhase = 'landing';
    updateVisibility();
}

// --- Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- Post Processing ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.85; // Higher threshold = fewer things glow
bloomPass.strength = 0.4; // Lower strength = less intense
bloomPass.radius = 0.2; // Sharper glow
composer.addPass(bloomPass);

// --- Background Shader ---
// Create a plane that fills the camera view
const bgGeometry = new THREE.PlaneGeometry(1, 1);
const bgMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2() },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    depthTest: false,
    depthWrite: false
});
const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
bgMesh.renderOrder = -999; // Ensure it renders behind everything

// Attach background to camera so it's always visible
const bgDistance = 10;
bgMesh.position.z = -bgDistance;
bgMesh.frustumCulled = false; // Prevent culling issues
camera.add(bgMesh);
scene.add(camera);

// Function to update background size
function updateBackgroundSize() {
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(vFOV / 2) * bgDistance;
    const width = height * camera.aspect;
    bgMesh.scale.set(width, height, 1);
}
updateBackgroundSize();

// --- Objects ---
let keywordGroup = new THREE.Group();
keywordGroup.visible = false; // Start hidden, will be shown when entering 'active' phase
scene.add(keywordGroup);
let particles = null;

// Keywords will be created after projects load
// (removed createKeywords() call from here)


// --- Functions ---

function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 64;
    ctx.font = `200 ${fontSize}px ${FONT_FAMILY}`;

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;

    // Resize canvas with EXTRA PADDING for easier hover
    const padding = 40;
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;

    // Draw text
    ctx.font = `200 ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);

    // Use Mesh instead of Sprite for better raycasting (rectangular hit area)
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0, // Start invisible
        color: 0xffffff,
        depthTest: false,
        side: THREE.DoubleSide // Visible from both sides
    }); const scaleFactor = 0.005;
    const geometry = new THREE.PlaneGeometry(canvas.width * scaleFactor, canvas.height * scaleFactor);
    const mesh = new THREE.Mesh(geometry, material);

    return mesh;
}

function createKeywords() {
    // Safety check - don't create if KEYWORDS is empty
    if (!KEYWORDS || KEYWORDS.length === 0) {
        console.warn('KEYWORDS is empty, waiting for projects to load...');
        return;
    }

    KEYWORDS.forEach((word, i) => {
        const mesh = createTextSprite(word);

        // Random position - fill the entire world space
        // Use WORLD_SIZE to ensure keywords are distributed across the whole looping area
        mesh.position.x = (Math.random() - 0.5) * WORLD_SIZE * 1.4;
        mesh.position.y = (Math.random() - 0.5) * WORLD_SIZE * 0.9; // Less vertical spread
        mesh.position.z = (Math.random() - 0.5) * WORLD_SIZE * 1.4;

        mesh.userData = {
            originalPos: mesh.position.clone(),
            word: word,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01),
            hovered: false,
            selected: false,
            baseScaleX: 1,
            baseScaleY: 1
        };

        keywordGroup.add(mesh);
    });
}

function normalizeWord(value) {
    return value.trim().toLowerCase();
}

function createUserWordMesh(word) {
    const mesh = createTextSprite(word);
    mesh.position.x = (Math.random() - 0.5) * WORLD_SIZE * 1.4;
    mesh.position.y = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    mesh.position.z = (Math.random() - 0.5) * WORLD_SIZE * 1.4;

    mesh.userData = {
        originalPos: mesh.position.clone(),
        word: word,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01),
        hovered: false,
        selected: false,
        baseScaleX: 1,
        baseScaleY: 1,
        userWord: true
    };

    keywordGroup.add(mesh);
    gsap.to(mesh.material, { opacity: 0.6, duration: 1.2 });
    return mesh;
}

function markUserWordMesh(mesh, wordKey) {
    mesh.userData.userWord = true;
    mesh.userData.userWordKey = wordKey;
    state.findYourself.wordMeshes[wordKey] = mesh;
}

function addFindWordToField(rawWord) {
    const trimmed = rawWord.trim();
    if (!trimmed) return null;

    const key = normalizeWord(trimmed);
    if (!key || state.findYourself.words.includes(key)) return null;

    const existingMesh = keywordGroup.children.find(m => m.userData.word && normalizeWord(m.userData.word) === key);
    const mesh = existingMesh || createUserWordMesh(trimmed);
    markUserWordMesh(mesh, key);
    state.findYourself.words.push(key);
    return mesh;
}

function applyFindWordsToField(words) {
    if (!words || words.length === 0) return;
    if (!keywordGroup || keywordGroup.children.length === 0) {
        state.findYourself.pendingWords = words.slice();
        state.findYourself.active = true;
        return;
    }

    words.forEach(word => addFindWordToField(word));
    state.findYourself.active = true;
}

function resetFindYourselfState() {
    state.findYourself.active = false;
    state.findYourself.words = [];
    state.findYourself.selectedWords = [];
    state.findYourself.selectedMeshes = [];
    state.findYourself.inputWords = [];
    state.findYourself.pendingWords = [];

    Object.values(state.findYourself.wordMeshes).forEach(mesh => {
        if (!mesh) return;
        if (mesh.parent) {
            mesh.parent.remove(mesh);
        } else {
            scene.remove(mesh);
        }
    });
    state.findYourself.wordMeshes = {};

    if (ui && ui.containers && ui.containers.findWords) {
        renderFindWordsList();
    }
}

function createExplosion(originsInput) {
    const origins = Array.isArray(originsInput) ? originsInput : [originsInput];
    if (!origins.length) return;

    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        const origin = origins[i % origins.length];
        positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.6;
        positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.4;
        positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.4;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 2 + Math.random() * 4;
        const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );

        velocities.push({
            x: dir.x * speed,
            y: dir.y * speed,
            z: dir.z * speed
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xe3e4ff,
        size: 0.05,
        transparent: true,
        opacity: 1
    });

    particles = new THREE.Points(geometry, material);
    particles.userData = {
        velocities: velocities,
        lastTime: performance.now(),
        age: 0,
        lifespan: 3.4
    };
    scene.add(particles);
}

function getLandingTitleOrigins() {
    const titleEl = document.querySelector('#landing-title h1');
    if (!titleEl) return [new THREE.Vector3(0, 0, 0)];

    if (!titleEl.dataset.split) {
        const text = titleEl.textContent || '';
        titleEl.innerHTML = text.split('').map(char => {
            if (char === ' ') return `<span class="landing-char space">&nbsp;</span>`;
            return `<span class="landing-char">${char}</span>`;
        }).join('');
        titleEl.dataset.split = 'true';
    }

    const spans = Array.from(titleEl.querySelectorAll('.landing-char')).filter(span => !span.classList.contains('space'));
    if (!spans.length) return [new THREE.Vector3(0, 0, 0)];

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const planeNormal = forward.clone().normalize();
    const planePoint = camera.position.clone().add(forward.multiplyScalar(4.2));

    const origins = [];
    spans.forEach(span => {
        const rect = span.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const ndcX = (rect.left + rect.width / 2) / window.innerWidth * 2 - 1;
        const ndcY = -((rect.top + rect.height / 2) / window.innerHeight) * 2 + 1;
        const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const denom = dir.dot(planeNormal);
        if (Math.abs(denom) < 1e-4) return;

        const distanceToPlane = planePoint.clone().sub(camera.position).dot(planeNormal) / denom;
        const pos = camera.position.clone().add(dir.multiplyScalar(distanceToPlane));
        origins.push(pos);
    });

    return origins.length ? origins : [new THREE.Vector3(0, 0, 0)];
}

// --- Interaction ---

function onMouseMove(event) {
    // Normalize mouse for shader
    state.targetMouse.x = event.clientX / window.innerWidth;
    state.targetMouse.y = 1.0 - event.clientY / window.innerHeight;

    // Normalize for raycaster
    state.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    state.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Custom Cursor Logic
    const cursor = document.getElementById('cursor');
    const windVane = cursor.querySelector('.wind-vane');

    // Move cursor container to exact mouse position
    gsap.to(cursor, {
        x: event.clientX,
        y: event.clientY,
        duration: 0.1
    });

    // Rotate based on movement direction
    // Default orientation of our arrow shape is pointing Top-Right (45 deg)
    // We want it to point in the direction of movement
    const dx = event.movementX;
    const dy = event.movementY;

    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        // Calculate angle of movement
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // IMPORTANT: The uploaded cursor image should point to the RIGHT (East).
        // If your image points UP, change this to: angle + 90
        // If your image points Top-Right, change this to: angle - 45

        gsap.to(windVane, {
            rotation: angle,
            duration: 0.5
        });
    }

    // --- Hover Logic ---
    if (state.view === 'field' && state.fieldPhase === 'active') {
        // Raycast for keywords
        state.raycaster.setFromCamera(state.mouse, camera);
        const intersects = state.raycaster.intersectObjects(keywordGroup.children);

        // Reset hover state for all
        keywordGroup.children.forEach(sprite => {
            if (!sprite.userData.selected) {
                if (sprite.userData.hovered) {
                    sprite.userData.hovered = false;
                    gsap.to(sprite.material, { opacity: 0.6, duration: 0.3 });
                    gsap.to(sprite.material.color, { r: 1, g: 1, b: 1, duration: 0.3 });
                    gsap.to(sprite.scale, { x: sprite.userData.baseScaleX, y: sprite.userData.baseScaleY, duration: 0.3 });
                }
            }
        });

        if (intersects.length > 0) {
            const object = intersects[0].object;

            // Store base scale if not stored
            if (!object.userData.baseScaleX) {
                object.userData.baseScaleX = object.scale.x;
                object.userData.baseScaleY = object.scale.y;
            }

            // Hover Effect
            if (!object.userData.hovered && !object.userData.selected) {
                object.userData.hovered = true;
                gsap.to(object.material, { opacity: 1.0, duration: 0.2 });
                // Target Color: #408F98 -> r:0.25, g:0.56, b:0.60
                gsap.to(object.material.color, { r: 0.25, g: 0.56, b: 0.60, duration: 0.2 });
                gsap.to(object.scale, { x: object.userData.baseScaleX * 1.2, y: object.userData.baseScaleY * 1.2, duration: 0.2 });
            }
        }
    }
}



function onClick(event) {
    // Prevent interaction if clicking on UI elements (Nav, etc.)
    if (event.target.closest('.nav-link') || event.target.closest('.menu-item')) {
        return;
    }

    // Handle Gallery click
    if (state.view === 'gallery') {
        onGalleryClick();
        return;
    }

    // Only allow interactions if we are in the Field View
    if (state.view !== 'field') return;

    if (state.fieldPhase === 'landing') {
        // Shatter Title
        const landingTitle = document.getElementById('landing-title');
        const origins = getLandingTitleOrigins();
        createExplosion(origins);
        if (landingTitle) {
            landingTitle.style.opacity = '0';
        }
        state.fieldPhase = 'shattering';
        updateVisibility();

        // Transition to Field
        setTimeout(() => {
            state.fieldPhase = 'active';
            updateVisibility();
            // Fade in keywords
            keywordGroup.children.forEach(mesh => {
                gsap.to(mesh.material, { opacity: 0.6, duration: 2 });
            });
            scheduleFieldHelpOverlay();
        }, 1600);

    } else if (state.fieldPhase === 'active') {
        // Raycast for keywords
        state.raycaster.setFromCamera(state.mouse, camera);
        const intersects = state.raycaster.intersectObjects(keywordGroup.children);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            const word = object.userData.word;

            if (object.userData.userWord && state.findYourself.active) {
                if (!object.userData.selected) {
                    selectUserKeyword(object);
                } else {
                    createUserHintLines(object);
                }
                return;
            }

            // Select Logic - only if not already selected
            if (!object.userData.selected) {
                selectKeyword(object);

                // Check for project match
                const matchedProject = checkProjectMatch();
                if (matchedProject) {
                    unlockProject(matchedProject);
                }
            }
        }
    }
}

// --- Keyword Selection System ---

// Store hint lines (lines connecting to related keywords in 3D space)
let hintLines = [];

function selectKeyword(mesh) {
    const word = mesh.userData.word;

    // Add to collected
    state.collectedKeywords.push(mesh);
    state.collectedWords.push(word);
    mesh.userData.selected = true;

    // Kill any existing animations on this mesh's material to prevent conflicts
    gsap.killTweensOf(mesh.material);
    gsap.killTweensOf(mesh.material.color);
    gsap.killTweensOf(mesh.scale);

    // Visual feedback - bright highlight color for selected keywords
    mesh.material.color.setHex(0x00FFCC); // Bright cyan/mint for better visibility
    mesh.material.opacity = 1;

    // Store current scale as base if not already stored
    if (!mesh.userData.baseScaleX) {
        mesh.userData.baseScaleX = mesh.scale.x;
        mesh.userData.baseScaleY = mesh.scale.y;
    }

    // Add a subtle glow effect by scaling up slightly from base scale
    gsap.to(mesh.scale, {
        x: mesh.userData.baseScaleX * 1.15,
        y: mesh.userData.baseScaleY * 1.15,
        z: 1.15,
        duration: 0.3,
        ease: "back.out"
    });

    // Bloom burst
    const light = new THREE.PointLight(0x00FFCC, 8, 15);
    light.position.copy(mesh.position);
    scene.add(light);
    gsap.to(light, { intensity: 0, duration: 1.5, onComplete: () => scene.remove(light) });

    // Redistribute other keywords - gentle movement to new positions
    redistributeKeywords(mesh);

    // Update bottom bar UI
    updateBottomBar();

    // Create hint lines to related keywords in 3D space
    createHintLines(word);
}

function selectUserKeyword(mesh) {
    const wordKey = mesh.userData.userWordKey || normalizeWord(mesh.userData.word);
    if (state.findYourself.selectedWords.includes(wordKey)) {
        createUserHintLines(mesh);
        return;
    }

    state.findYourself.selectedWords.push(wordKey);
    state.findYourself.selectedMeshes.push(mesh);
    mesh.userData.selected = true;

    gsap.killTweensOf(mesh.material);
    gsap.killTweensOf(mesh.material.color);
    gsap.killTweensOf(mesh.scale);

    mesh.material.color.setHex(0x00FFCC);
    mesh.material.opacity = 1;

    if (!mesh.userData.baseScaleX) {
        mesh.userData.baseScaleX = mesh.scale.x;
        mesh.userData.baseScaleY = mesh.scale.y;
    }

    gsap.to(mesh.scale, {
        x: mesh.userData.baseScaleX * 1.15,
        y: mesh.userData.baseScaleY * 1.15,
        z: 1.15,
        duration: 0.3,
        ease: "back.out"
    });

    const light = new THREE.PointLight(0x00FFCC, 8, 15);
    light.position.copy(mesh.position);
    scene.add(light);
    gsap.to(light, { intensity: 0, duration: 1.5, onComplete: () => scene.remove(light) });

    redistributeKeywords(mesh);
    createUserHintLines(mesh);

    if (state.findYourself.selectedWords.length >= 3 && !state.findYourself.sequenceActive) {
        startFindYourselfSequence();
    }
}

// Redistribute keywords after selection - "World Flow" vortex/orbit effect
function redistributeKeywords(selectedMesh) {
    const center = selectedMesh.position.clone();

    keywordGroup.children.forEach((mesh, index) => {
        // Skip selected keywords
        if (mesh.userData.selected) return;

        // Calculate current direction relative to the selected object
        let direction = new THREE.Vector3().subVectors(mesh.position, center).normalize();
        if (direction.lengthSq() === 0) direction.set(1, 0, 0); // Safety

        // Define a target orbit radius - distribute them in layers
        const layer = (index % 3) + 1;
        const targetRadius = 8 + layer * 4; // 12, 16, 20...

        // Calculate a target position on a sphere/ring around the selected object
        // We want them to swirl, so we add a rotation to their current angle
        const axis = new THREE.Vector3(0, 1, 0);
        const angle = Math.PI / 2 + (Math.random() * 0.5); // Rotate ~90 degrees around center

        direction.applyAxisAngle(axis, angle);

        const targetPos = center.clone().add(direction.multiplyScalar(targetRadius));

        // Add some vertical variation
        targetPos.y += (Math.random() - 0.5) * 6;

        // Animate with a "slingshot" ease
        gsap.to(mesh.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 2.5,
            ease: "power4.inOut"
        });
    });
}

// Find all projects that contain a given keyword
function findProjectsWithKeyword(word) {
    return PROJECTS_DATA.filter(p => p.keywords.includes(word));
}

// Create lines in 3D space connecting to related keywords
function createHintLines(selectedWord) {
    // Clear existing hint lines
    clearHintLines();

    // Find all projects that the selected word belongs to
    const relatedProjects = findProjectsWithKeyword(selectedWord);

    // Find the mesh for the selected word
    const selectedMesh = keywordGroup.children.find(m => m.userData.word === selectedWord);
    if (!selectedMesh) return;
    if (selectedMesh.userData.userWord) {
        createUserHintLines(selectedMesh);
        return;
    }

    // Collect all potential target keywords from all related projects
    let potentialTargets = new Set();

    relatedProjects.forEach(project => {
        // Skip already collected projects
        if (state.collectedProjects[project.id]) return;

        project.keywords.forEach(keyword => {
            // Skip the selected word itself and already selected words
            if (keyword !== selectedWord && !state.collectedWords.includes(keyword)) {
                potentialTargets.add(keyword);
            }
        });
    });

    // Convert to array and shuffle
    const targetsArray = Array.from(potentialTargets);
    // Fisher-Yates shuffle
    for (let i = targetsArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [targetsArray[i], targetsArray[j]] = [targetsArray[j], targetsArray[i]];
    }

    // Take max 5
    const selectedTargets = targetsArray.slice(0, 5);

    // Draw lines to these targets
    selectedTargets.forEach(keyword => {
        // Find the mesh for this keyword
        const targetMesh = keywordGroup.children.find(m => m.userData.word === keyword);
        if (!targetMesh) return;

        // Create a hint line - always visible regardless of distance
        const points = [selectedMesh.position.clone(), targetMesh.position.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x5BC0BE, // Brighter cyan
            transparent: true,
            opacity: 0, // Start invisible
            depthTest: false, // Always render on top, visible at any distance
            depthWrite: false
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 999; // Render after other objects
        line.userData = {
            startMesh: selectedMesh,
            endMesh: targetMesh
        };
        scene.add(line);
        hintLines.push(line);

        // Fade in the line - higher opacity for visibility
        gsap.to(material, { opacity: 0.4, duration: 1 });

        // Highlight the target keyword more strongly
        if (!targetMesh.userData.selected && !targetMesh.userData.hinted) {
            targetMesh.userData.hinted = true;
            gsap.to(targetMesh.material, { opacity: 1, duration: 0.5 });
            // Also tint it slightly
            gsap.to(targetMesh.material.color, { r: 0.36, g: 0.75, b: 0.74, duration: 0.5 });
        }
    });
}

function createUserHintLines(selectedMesh) {
    clearHintLines();
    const userMeshes = keywordGroup.children.filter(m => m.userData.userWord && m !== selectedMesh);
    if (userMeshes.length === 0) return;

    userMeshes.forEach(targetMesh => {
        const points = [selectedMesh.position.clone(), targetMesh.position.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x8FFFE6,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 999;
        line.userData = {
            startMesh: selectedMesh,
            endMesh: targetMesh
        };
        scene.add(line);
        hintLines.push(line);

        gsap.to(material, { opacity: 0.5, duration: 0.6 });

        if (!targetMesh.userData.selected && !targetMesh.userData.hinted) {
            targetMesh.userData.hinted = true;
            gsap.to(targetMesh.material, { opacity: 1, duration: 0.5 });
            gsap.to(targetMesh.material.color, { r: 0.6, g: 0.9, b: 0.85, duration: 0.5 });
        }
    });
}

function clearHintLines() {
    hintLines.forEach(line => {
        gsap.to(line.material, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => scene.remove(line)
        });
    });
    hintLines = [];

    // Reset hinted state on keywords
    keywordGroup.children.forEach(mesh => {
        if (mesh.userData.hinted && !mesh.userData.selected) {
            mesh.userData.hinted = false;
        }
    });
}

function setHintLinesVisible(visible) {
    if (!hintLines || hintLines.length === 0) return;
    hintLines.forEach(line => {
        line.visible = visible;
    });
}

function updateBottomBar() {
    // Update HTML bottom bar with collected words
    const bottomBar = document.getElementById('collected-keywords-bar');
    if (!bottomBar) return;

    bottomBar.innerHTML = '';

    // Create inner container for scrolling
    const innerContainer = document.createElement('div');
    innerContainer.className = 'collected-words-inner';

    state.collectedWords.forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'collected-word';
        span.textContent = word;
        innerContainer.appendChild(span);

        if (i < state.collectedWords.length - 1) {
            const connector = document.createElement('span');
            connector.className = 'word-connector';
            connector.textContent = '—';
            innerContainer.appendChild(connector);
        }
    });

    bottomBar.appendChild(innerContainer);
    bottomBar.classList.toggle('visible', state.collectedWords.length > 0);

    // Auto-scroll to show the newest word on the right
    requestAnimationFrame(() => {
        const barWidth = bottomBar.clientWidth;
        const contentWidth = innerContainer.scrollWidth;

        if (contentWidth > barWidth) {
            // Shift left so the newest word is visible on the right
            const offset = contentWidth - barWidth + 40; // 40px padding
            gsap.to(innerContainer, {
                x: -offset,
                duration: 0.4,
                ease: "power2.out"
            });
        } else {
            // Reset position if content fits
            gsap.set(innerContainer, { x: 0 });
        }
    });
}

function scatterSentenceToField(sentenceOverlay, onComplete) {
    if (!sentenceOverlay) {
        if (onComplete) onComplete();
        return;
    }

    const letters = sentenceOverlay.querySelectorAll('span');
    if (letters.length === 0) {
        if (onComplete) onComplete();
        return;
    }

    let finished = 0;
    letters.forEach(span => {
        const rect = span.getBoundingClientRect();
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const dirX = rect.left - centerX;
        const dirY = rect.top - centerY;

        gsap.to(span, {
            x: dirX * 2 + (Math.random() - 0.5) * 500,
            y: dirY * 2 + (Math.random() - 0.5) * 500,
            opacity: 0,
            rotation: Math.random() * 360,
            duration: 1.5,
            ease: "power2.in",
            onComplete: () => {
                finished += 1;
                if (finished >= letters.length) {
                    if (sentenceOverlay.parentNode) {
                        sentenceOverlay.remove();
                    }
                    if (onComplete) onComplete();
                }
            }
        });
    });
}

function startFindYourselfSequence() {
    state.fieldPhase = 'unlocking';
    state.findYourself.sequenceActive = true;

    const matchedMeshes = state.findYourself.selectedMeshes.slice(0, 3);
    if (matchedMeshes.length < 3) {
        state.findYourself.sequenceActive = false;
        state.fieldPhase = 'active';
        return;
    }

    keywordGroup.children.forEach(mesh => {
        if (!matchedMeshes.includes(mesh)) {
            gsap.to(mesh.material, { opacity: 0, duration: 0.8 });
        }
    });

    clearHintLines();

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const centerAnchor = camera.position.clone().add(forward.multiplyScalar(6));
    const gap = 0.7;
    const wordWidths = matchedMeshes.map(mesh => {
        const baseWidth = mesh.geometry.parameters.width || 1;
        return baseWidth * (mesh.userData.baseScaleX || 1) * 1.4;
    });
    const totalWidth = wordWidths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, matchedMeshes.length - 1);
    let cursor = -totalWidth / 2;

    matchedMeshes.forEach((mesh, index) => {
        mesh.visible = true;
        mesh.renderOrder = 1000;
        mesh.userData.findOriginalPos = mesh.userData.originalPos ? mesh.userData.originalPos.clone() : mesh.position.clone();

        const width = wordWidths[index];
        const offset = cursor + width / 2;
        cursor += width + gap;
        const targetPos = centerAnchor.clone().add(right.clone().multiplyScalar(offset));

        gsap.to(mesh.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 2.2,
            ease: "power3.inOut"
        });
        gsap.to(mesh.rotation, {
            y: mesh.rotation.y + Math.PI * 2,
            duration: 2.2,
            ease: "power2.inOut"
        });
        gsap.to(mesh.scale, {
            x: mesh.userData.baseScaleX * 1.4,
            y: mesh.userData.baseScaleY * 1.4,
            z: 1.4,
            duration: 2.2,
            ease: "power3.out"
        });
    });

    const bottomBar = document.getElementById('collected-keywords-bar');
    if (bottomBar) bottomBar.classList.remove('visible');

    gsap.delayedCall(2.6, () => {
        explodeKeywordsToSentence(
            { fullSentence: FIND_SENTENCE },
            matchedMeshes,
            null,
            {
                sentenceText: FIND_SENTENCE,
                removeMeshes: false,
                enableBlur: false,
                onComplete: (sentenceOverlay) => {
                    scatterSentenceToField(sentenceOverlay, () => {
                        finishFindYourselfSequence(matchedMeshes);
                    });
                }
            }
        );
    });
}

function finishFindYourselfSequence(matchedMeshes) {
    keywordGroup.children.forEach(mesh => {
        if (!matchedMeshes.includes(mesh) && !mesh.userData.selected) {
            gsap.to(mesh.material, { opacity: 0.6, duration: 1.2 });
        }
    });

    matchedMeshes.forEach(mesh => {
        mesh.visible = true;
        mesh.userData.selected = false;
        mesh.userData.fixed = false;
        mesh.userData.hinted = false;
        mesh.material.color.setHex(0xffffff);
        gsap.to(mesh.material, { opacity: 0.6, duration: 0.6 });

        const baseScaleX = mesh.userData.baseScaleX || 1;
        const baseScaleY = mesh.userData.baseScaleY || 1;
        gsap.to(mesh.scale, { x: baseScaleX, y: baseScaleY, z: 1, duration: 1.2, ease: "power3.out" });

        if (mesh.userData.findOriginalPos) {
            gsap.to(mesh.position, {
                x: mesh.userData.findOriginalPos.x,
                y: mesh.userData.findOriginalPos.y,
                z: mesh.userData.findOriginalPos.z,
                duration: 1.6,
                ease: "power3.inOut"
            });
        }
    });

    clearHintLines();
    state.findYourself.selectedWords = [];
    state.findYourself.selectedMeshes = [];
    state.findYourself.sequenceActive = false;
    state.fieldPhase = 'active';
    updateVisibility();
}

// --- Finale Sequence (Galaxy ending) ---

function startFinaleSequence(triggerSource = 'manual') {
    if (finaleState.active) return;
    finaleState.active = true;
    state.view = 'field';
    state.fieldPhase = 'ending';
    clearHintLines();
    if (keywordGroup) keywordGroup.visible = true;

    prepareFinaleOrbits();
    startFinaleSpin().then(() => {
        gsap.delayedCall(3, () => startFinaleExplosionStage()); // 停下来后额外等待 3 秒
    });
}

function prepareFinaleOrbits() {
    const center = new THREE.Vector3(0, 0, 0);
    keywordGroup.children.forEach(mesh => {
        const offset = mesh.position.clone().sub(center);
        const radius = Math.max(4, offset.length());
        const angle = Math.atan2(offset.z, offset.x);
        const tilt = Math.atan2(offset.y, Math.max(0.001, Math.sqrt(offset.x * offset.x + offset.z * offset.z)));
        mesh.userData.finaleOrbit = {
            radius,
            baseAngle: angle,
            tilt,
            speed: 0.6 + Math.random() * 0.7,
            wobble: Math.random() * Math.PI * 2
        };
        gsap.to(mesh.material, { opacity: 0.9, duration: 1.2 });
    });
}

function startFinaleSpin() {
    finaleState.spinning = true;
    finaleState.spinAngle = 0;
    finaleState.spinSpeed = 0.2;

    return new Promise(resolve => {
        const tl = gsap.timeline({
            onComplete: () => {
                finaleState.spinning = false;
                resolve();
            }
        });

        tl.to(finaleState, { spinSpeed: 1.4, duration: 2.2, ease: "power2.inOut" })
            .to(finaleState, { spinSpeed: 4.5, duration: 3.4, ease: "power3.in" })
            .to(finaleState, { spinSpeed: 10.5, duration: 2.6, ease: "power3.in" })
            .to(finaleState, { spinSpeed: 0.08, duration: 1.8, ease: "expo.out" });
    });
}

function updateFinaleSpin(deltaTime) {
    if (!finaleState.active) return;
    finaleState.spinAngle += finaleState.spinSpeed * deltaTime;

    keywordGroup.children.forEach(mesh => {
        if (mesh.userData.selected) return;
        if (!mesh.userData.finaleOrbit) return;

        const orbit = mesh.userData.finaleOrbit;
        const angle = orbit.baseAngle + finaleState.spinAngle * orbit.speed;
        const radius = orbit.radius;
        const wobbleY = Math.sin(angle * 0.35 + orbit.wobble) * (radius * 0.12);

        mesh.quaternion.copy(camera.quaternion);
        mesh.position.x = Math.cos(angle) * radius;
        mesh.position.z = Math.sin(angle) * radius;
        mesh.position.y = wobbleY;
    });
}

function startFinaleExplosionStage() {
    const allMeshes = keywordGroup.children.slice();
    // 隐藏所有词（爆炸后应消失）
    allMeshes.forEach(mesh => {
        mesh.visible = false;
        gsap.set(mesh.material, { opacity: 0 });
    });

    // 构造词标题（先透明，用 Doto）
    const overlay = createFinaleWordOverlay('WHERE');
    // 取部分关键词位置作为爆炸源
    const origins = allMeshes.slice(0, 30).map(m => m.position.clone());
    createFinaleBurstAndGather(origins.length ? origins : [new THREE.Vector3(0, 0, 0)], overlay, () => {
        startFinaleWordCycle(overlay);
    });
}

function createFinaleWordOverlay(text) {
    const overlay = document.createElement('div');
    overlay.className = 'sentence-overlay finale-overlay';
    overlay.style.opacity = '0';
    overlay.innerHTML = `<p class="full-sentence finale-word">${text}</p>`;
    document.body.appendChild(overlay);
    return overlay;
}

function createFinaleBurstAndGather(origins, overlay, onDone) {
    const particleCount = 3600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        const origin = origins[i % origins.length];
        positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.8;
        positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.8;
        positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.8;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 6 + Math.random() * 10;
        const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );
        velocities.push({ x: dir.x * speed, y: dir.y * speed, z: dir.z * speed });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xe3e4ff,
        size: 0.06,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const system = new THREE.Points(geometry, material);
    scene.add(system);

    const gatherStart = 1.0; // 爆炸 1 秒后开始汇聚
    const gatherDuration = 5.0;
    const center = new THREE.Vector3(0, 0, -2);
    const gatherPlan = Array.from({ length: particleCount }, () => gatherStart + Math.random() * gatherDuration);
    const driftDrag = 0.92; // 衰减慢一点
    const startTime = performance.now();
    let last = startTime;

    // 字幕淡入（延迟到汇聚后段再出现）
    if (overlay) {
        const fadeDelay = gatherDuration * 1; // 在汇聚后段再显现
        const fadeDur = gatherDuration - fadeDelay;
        gsap.to(overlay, { opacity: 1, duration: Math.max(0.8, fadeDur), delay: fadeDelay, ease: "power2.out" });
        const textEl = overlay.querySelector('.full-sentence');
        if (textEl) {
            textEl.style.fontFamily = "'Doto', sans-serif";
            textEl.style.letterSpacing = '0.2em';
            textEl.style.fontWeight = '400';
            textEl.style.fontSize = '5.2rem';
        }
    }

    function tick() {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;
        const delta = Math.min((now - last) / 1000, 0.05);
        last = now;

        const pos = system.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const v = velocities[i];

            if (elapsed < gatherStart) {
                // 爆炸阶段
                const drag = Math.pow(driftDrag, delta);
                v.x *= drag;
                v.y *= drag;
                v.z *= drag;
                pos[i * 3] += v.x * delta * 6.5;
                pos[i * 3 + 1] += v.y * delta * 6.5;
                pos[i * 3 + 2] += v.z * delta * 6.5;
            } else {
                // 汇聚阶段：按时间片分批启动
                const startT = gatherPlan[i];
                if (elapsed >= startT) {
                    // 缓慢非线性靠近中心
                    const lerp = 1 - Math.exp(-2 * delta);
                    pos[i * 3] += (center.x - pos[i * 3]) * lerp;
                    pos[i * 3 + 1] += (center.y - pos[i * 3 + 1]) * lerp;
                    pos[i * 3 + 2] += (center.z - pos[i * 3 + 2]) * lerp;
                } else {
                    // 继续漂浮
                    const drag = Math.pow(driftDrag, delta);
                    v.x *= drag;
                    v.y *= drag;
                    v.z *= drag;
                    pos[i * 3] += v.x * delta * 3.2;
                    pos[i * 3 + 1] += v.y * delta * 3.2;
                    pos[i * 3 + 2] += v.z * delta * 3.2;
                }
            }
        }

        system.geometry.attributes.position.needsUpdate = true;

        // 汇聚期整体渐隐
        if (elapsed >= gatherStart) {
            const fadeProgress = Math.min((elapsed - gatherStart) / gatherDuration, 1);
            material.opacity = 1 - fadeProgress;
        }

        if (material.opacity > 0.02) {
            requestAnimationFrame(tick);
        } else {
            scene.remove(system);
            if (onDone) onDone();
        }
    }

    tick();
}

function startFinaleWordCycle(sentenceOverlay) {
    const textEl = sentenceOverlay.querySelector('.full-sentence');
    if (!textEl) return;

    textEl.classList.add('finale-word');
    const words = [
        'WHERE', 'DO', 'WE', 'GO', 'NEXT', 'FIND', 'SELF', 'FREE', 'LIFE', 'EXIST', 'TIME', 'ICE', 'HOW', 'BECOME', 'ESCAPE', 'STAY', 'MOVE', 'DRIFT', 'WANDER', 'SEARCH', 'FORGET', 'REMEMBER', 'RETURN', 'ARRIVE', 'INSIDE', 'OUTSIDE', 'BETWEEN', 'EDGE', 'BORDER', 'SHELL', 'CORE', 'SKIN', 'MASK', 'NAME', 'VOICE', 'SHAPE', 'NOW', 'THEN', 'STILL', 'AGAIN', 'ALREADY', 'YET', 'SOON', 'LATE', 'PAUSE', 'LOOP', 'TRACE', 'FADING', 'HERE', 'THERE', 'NOWHERE', 'ANYWHERE', 'ROOM', 'FIELD', 'VOID', 'PATH', 'ROAD', 'SHELTER', 'ORIGIN', 'QUIET', 'HOME', 'NEVER', 'DEFINE', 'END', 'YOU'
    ];
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const zoomTarget = camera.position.clone().add(forward.multiplyScalar(3.5));

    const timeline = gsap.timeline({
        onComplete: () => {
            gsap.delayedCall(5, () => explodeFinaleYou(sentenceOverlay));
        }
    });

    const maxDur = 0.7; // edges slower
    const minDur = 0.08; // middle faster

    words.forEach((word, index) => {
        const t = words.length > 1 ? index / (words.length - 1) : 0;
        const shape = Math.sin(Math.PI * t); // 0 at edges, 1 in middle
        const dur = minDur + (1 - shape) * (maxDur - minDur); // slow -> fast -> slow
        const fadeOut = dur * 0.45;
        const fadeIn = dur * 0.45;
        const gap = dur * 0.25;

        timeline.to(textEl, {
            opacity: 0.2,
            duration: Math.max(0.05, fadeOut),
            ease: "power1.in"
        });
        timeline.add(() => { textEl.textContent = word; });
        timeline.to(textEl, {
            opacity: 1,
            duration: Math.max(0.06, fadeIn),
            ease: "power1.out"
        });
        if (index < words.length - 1) {
            timeline.to({}, { duration: Math.max(0.04, gap) });
        }
    });

    gsap.to(camera.position, {
        x: zoomTarget.x,
        y: zoomTarget.y,
        z: zoomTarget.z,
        duration: timeline.duration() + 2,
        ease: "power3.inOut",
        onUpdate: () => camera.lookAt(0, 0, 0)
    });

    finaleState.wordTimeline = timeline;
}

function showFieldHelpOverlay() {
    if (state.helpShown) return;
    if (document.getElementById('field-help-overlay')) return;
    state.helpShown = true;

    const overlay = document.createElement('div');
    overlay.id = 'field-help-overlay';
    overlay.className = 'field-help-overlay';
    overlay.innerHTML = `
        <div class="field-help-text-only">
            <div class="help-row">
                <div class="key-cluster">
                    <div class="key-row">
                        <span class="keycap">W</span>
                    </div>
                    <div class="key-row">
                        <span class="keycap">A</span>
                        <span class="keycap">S</span>
                        <span class="keycap">D</span>
                    </div>
                </div>
                <div class="help-text">MOVE</div>
            </div>
            <div class="help-row">
                <div class="key-cluster">
                    <div class="key-row">
                        <span class="keycap">Q</span>
                        <span class="keycap">E</span>
                    </div>
                </div>
                <div class="help-text">ROTATE UP / DOWN</div>
            </div>
            <div class="help-note">CLICK WORDS WITH MOUSE</div>
        </div>
    `;
    document.body.appendChild(overlay);

    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" });

    overlay.addEventListener('click', () => {
        gsap.to(overlay, {
            opacity: 0,
            duration: 0.4,
            ease: "power2.inOut",
            onComplete: () => overlay.remove()
        });
    });
}

function scheduleFieldHelpOverlay() {
    if (state.helpShown) return;
    const start = performance.now();

    function check() {
        if (state.helpShown) return;
        if (state.view === 'field' && state.fieldPhase === 'active' && !particles) {
            showFieldHelpOverlay();
            return;
        }
        if (performance.now() - start < 8000) {
            requestAnimationFrame(check);
        }
    }

    setTimeout(() => requestAnimationFrame(check), 1200);
}

function explodeFinaleYou(sentenceOverlay) {
    const textEl = sentenceOverlay.querySelector('.full-sentence');
    if (!textEl) return;

    const spans = wrapTextInSpans(textEl);
    const frozenCamera = camera.clone();
    frozenCamera.position.copy(camera.position);
    frozenCamera.quaternion.copy(camera.quaternion);
    frozenCamera.updateProjectionMatrix();
    frozenCamera.updateMatrixWorld();

    const planeNormal = new THREE.Vector3(0, 0, -1).applyQuaternion(frozenCamera.quaternion).normalize();
    const planePoint = frozenCamera.position.clone().add(planeNormal.clone().multiplyScalar(4.5));

    const origins = spans.map(span => {
        const rect = span.getBoundingClientRect();
        const ndcX = (rect.left + rect.width / 2) / window.innerWidth * 2 - 1;
        const ndcY = -((rect.top + rect.height / 2) / window.innerHeight) * 2 + 1;
        const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
        vector.unproject(frozenCamera);
        const dir = vector.sub(frozenCamera.position).normalize();
        const denom = dir.dot(planeNormal);
        if (Math.abs(denom) < 1e-4) return frozenCamera.position.clone();
        const distanceToPlane = planePoint.clone().sub(frozenCamera.position).dot(planeNormal) / denom;
        return frozenCamera.position.clone().add(dir.multiplyScalar(distanceToPlane));
    });

    createOverlayExplosion(origins, {
        particleCount: 2600,
        drag: 0.4,
        slowdown: true,
        lifespan: 7.5,
        color: 0x8fffe6
    });

    if (finaleState.particleSystem) {
        gsap.to(finaleState.particleSystem.material, {
            opacity: 0,
            duration: 1.2,
            onComplete: () => {
                scene.remove(finaleState.particleSystem);
                finaleState.particleSystem = null;
            }
        });
    }

    gsap.to(sentenceOverlay, {
        opacity: 0,
        duration: 0.6,
        onComplete: () => {
            sentenceOverlay.remove();
            gsap.delayedCall(5.2, () => showFinaleMessage());
        }
    });
}

function createOverlayExplosion(origins, opts = {}) {
    const particleCount = opts.particleCount || 2000;
    const dragBase = opts.drag !== undefined ? opts.drag : 0.25;
    const lifespan = opts.lifespan || 4.2;
    const color = opts.color || 0xe3e4ff;
    const slowdown = opts.slowdown || false;
    const speedMin = opts.speedMin || 10;
    const speedMax = opts.speedMax || 18;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        const origin = origins[i % origins.length] || new THREE.Vector3();
        positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.4;
        positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.4;
        positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.4;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );

        velocities.push({
            x: dir.x * speed,
            y: dir.y * speed,
            z: dir.z * speed
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color,
        size: 0.06,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const system = new THREE.Points(geometry, material);
    system.userData = { velocities, age: 0, last: performance.now() };
    scene.add(system);

    function tick() {
        const now = performance.now();
        const delta = Math.min((now - system.userData.last) / 1000, 0.05);
        system.userData.last = now;
        system.userData.age += delta;

        const pos = system.geometry.attributes.position.array;
        for (let i = 0; i < velocities.length; i++) {
            const v = velocities[i];
            let drag = Math.pow(dragBase, delta);
            if (slowdown && system.userData.age > 0.6) {
                drag = Math.pow(dragBase * 0.05, delta);
            }
            v.x *= drag;
            v.y *= drag;
            v.z *= drag;

            pos[i * 3] += v.x * delta * 6.5;
            pos[i * 3 + 1] += v.y * delta * 6.5;
            pos[i * 3 + 2] += v.z * delta * 6.5;
        }
        system.geometry.attributes.position.needsUpdate = true;

        const fade = Math.min(system.userData.age / lifespan, 1);
        system.material.opacity = 1 - fade;

        if (system.material.opacity > 0.02) {
            requestAnimationFrame(tick);
        } else {
            scene.remove(system);
        }
    }

    tick();
}

function wrapTextInSpans(element) {
    const text = element.textContent || '';
    element.innerHTML = text.split('').map(char => {
        if (char === ' ') return `<span class="landing-char space">&nbsp;</span>`;
        return `<span class="landing-char">${char}</span>`;
    }).join('');
    return Array.from(element.querySelectorAll('span'));
}

function showFinaleMessage() {
    const overlay = document.createElement('div');
    overlay.id = 'finale-message';
    overlay.className = 'sentence-overlay finale-overlay';
    overlay.innerHTML = `
        <div class="finale-lines">
            <p class="finale-line" data-line="1">Thank you for finding me.</p>
            <p class="finale-line second" data-line="2">Your turn to find yourself.</p>
        </div>
    `;
    document.body.appendChild(overlay);
    finaleState.messageOverlay = overlay;

    const lines = Array.from(overlay.querySelectorAll('.finale-line'));
    lines.forEach(line => wrapTextInSpans(line));

    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.8 });

    const first = overlay.querySelector('.finale-line[data-line="1"]');
    const second = overlay.querySelector('.finale-line[data-line="2"]');

    if (first) {
        gsap.fromTo(first, { y: 20, opacity: 0 }, {
            y: 0,
            opacity: 1,
            duration: 1.1,
            delay: 0.4,
            ease: "power2.out"
        });
    }

    if (second) {
        gsap.fromTo(second, { y: 20, opacity: 0 }, {
            y: 0,
            opacity: 1,
            duration: 1.1,
            delay: 5.4,
            ease: "power2.out"
        });
    }

    const scatterDelay = 5.4 + 10 + 0.5; // after second line shows, keep for ~10s
    gsap.delayedCall(scatterDelay, () => {
        scatterSentenceToField(overlay, () => {
            restoreFieldAfterFinale();
        });
    });
}

function restoreFieldAfterFinale() {
    finaleState.active = false;
    finaleState.spinning = false;

    if (finaleState.wordTimeline) {
        finaleState.wordTimeline.kill();
        finaleState.wordTimeline = null;
    }

    if (finaleState.overlay && finaleState.overlay.parentNode) {
        finaleState.overlay.remove();
    }
    if (finaleState.messageOverlay && finaleState.messageOverlay.parentNode) {
        finaleState.messageOverlay.remove();
    }

    keywordGroup.children.forEach(mesh => {
        mesh.userData.selected = false;
        mesh.userData.hinted = false;
        mesh.userData.finaleOrbit = null;
        mesh.visible = true;
        mesh.material.color.setHex(0xffffff);
        gsap.to(mesh.material, { opacity: 0.6, duration: 1.2 });
        if (mesh.userData.originalPos) {
            mesh.position.copy(mesh.userData.originalPos);
        }
    });

    gsap.to(camera.position, { x: 0, y: 0, z: 5, duration: 1.2, ease: "power2.out" });
    gsap.to(camera.rotation, { x: 0, y: 0, z: 0, duration: 1.2, ease: "power2.out" });

    state.fieldPhase = 'active';
    updateVisibility();
    if (viewName === 'field') {
        maybeTriggerFinale();
    }
}

// Finale trigger helper
function hasCollectedAllProjects() {
    return PROJECTS_DATA.length > 0 && Object.keys(state.collectedProjects).length >= PROJECTS_DATA.length;
}

function maybeTriggerFinale() {
    if (state.finaleTriggered || finaleState.active) return;
    if (state.view !== 'field') return;
    if (!hasCollectedAllProjects()) return;
    state.finaleTriggered = true;
    startFinaleSequence('auto');
}

// --- Project Matching System ---

function checkProjectMatch() {
    // Check if collected keywords match any project (at least MATCH_THRESHOLD keywords)
    for (const project of PROJECTS_DATA) {
        // Skip already collected projects
        if (state.collectedProjects[project.id]) continue;

        const matchedWords = state.collectedWords.filter(w => project.keywords.includes(w));
        if (matchedWords.length >= MATCH_THRESHOLD) {
            return { project, matchedWords };
        }
    }
    return null;
}

function unlockProject(match) {
    const { project, matchedWords } = match;
    state.fieldPhase = 'unlocking';
    state.currentUnlockingProject = project;

    // Start unlock animation sequence
    startUnlockSequence(project, matchedWords);
}

// --- Unlock Animation Sequence (Refined) ---

function startUnlockSequence(project, matchedWords) {
    state.fieldPhase = 'unlocking';
    state.currentUnlockingProject = project;

    // 1. Blur Background (Fade out non-selected keywords)
    // We do NOT use a DOM overlay here to avoid blocking the view of selected keywords
    keywordGroup.children.forEach(mesh => {
        if (!mesh.userData.selected) {
            gsap.to(mesh.material, { opacity: 0, duration: 0.8 });
        }
    });

    // Hide hint lines
    state.lines.forEach(line => {
        gsap.to(line.material, { opacity: 0, duration: 0.5 });
    });
    clearHintLines();

    // 2. Move collected keywords to center (stay in 3D, rotate into place)
    const matchedMeshes = state.collectedKeywords.filter(m => matchedWords.includes(m.userData.word));
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const centerAnchor = camera.position.clone().add(forward.multiplyScalar(6));
    const gap = 0.7;
    const wordWidths = matchedMeshes.map(mesh => {
        const baseWidth = mesh.geometry.parameters.width || 1;
        return baseWidth * (mesh.userData.baseScaleX || 1) * 1.4;
    });
    const totalWidth = wordWidths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, matchedMeshes.length - 1);
    let cursor = -totalWidth / 2;

    matchedMeshes.forEach((mesh, index) => {
        mesh.visible = true;
        mesh.renderOrder = 1000;

        const width = wordWidths[index];
        const offset = cursor + width / 2;
        cursor += width + gap;
        const targetPos = centerAnchor.clone().add(right.clone().multiplyScalar(offset));

        gsap.to(mesh.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 2.2,
            ease: "power3.inOut"
        });
        gsap.to(mesh.rotation, {
            y: mesh.rotation.y + Math.PI * 2,
            duration: 2.2,
            ease: "power2.inOut"
        });
        gsap.to(mesh.scale, {
            x: mesh.userData.baseScaleX * 1.4,
            y: mesh.userData.baseScaleY * 1.4,
            z: 1.4,
            duration: 2.2,
            ease: "power3.out"
        });
    });

    // Hide bottom bar
    const bottomBar = document.getElementById('collected-keywords-bar');
    if (bottomBar) bottomBar.classList.remove('visible');

    // Wait for user to see the collected words, then explode
    gsap.delayedCall(2.6, () => {
        explodeKeywordsToSentence(project, matchedMeshes, null, { removeMeshes: false }); // No blur overlay passed
    });
}

function explodeKeywordsToSentence(project, matchedMeshes, blurOverlay, options = {}) {
    const sentenceText = options.sentenceText || project.fullSentence;
    const removeMeshes = options.removeMeshes !== false;
    const enableBlur = options.enableBlur !== false;
    const particleCount = options.particleCount || 1500;
    const explosionDrag = options.explosionDrag !== undefined ? options.explosionDrag : 0.15;
    const scatterSpeed = options.scatterSpeed !== undefined ? options.scatterSpeed : 1.7;
    const fadeStart = options.fadeStart !== undefined ? options.fadeStart : 10.5;
    const fadeDuration = options.fadeDuration !== undefined ? options.fadeDuration : 4.0;
    const onTextShown = options.onTextShown;
    const completeAfter = options.completeAfter !== undefined ? options.completeAfter : 12.0;
    const speedMin = options.speedMin !== undefined ? options.speedMin : 5;
    const speedMax = options.speedMax !== undefined ? options.speedMax : 10;
    const approachSpeed = options.approachSpeed !== undefined ? options.approachSpeed : 7.4;
    const onComplete = options.onComplete || ((sentenceOverlay, activeBlur) => {
        transformSentenceToTitle(project, sentenceOverlay, activeBlur);
    });

    // 0. Skip blur overlay during this phase - we want particles to be visible
    // The blur will be created later in transformSentenceToTitle
    blurOverlay = null;

    // 1. Create Sentence Overlay (Invisible initially, used for positioning)
    const sentenceOverlay = document.createElement('div');
    sentenceOverlay.id = 'sentence-overlay';
    sentenceOverlay.className = 'sentence-overlay no-bg';
    sentenceOverlay.style.opacity = '0'; // Start invisible
    sentenceOverlay.innerHTML = `<p class="full-sentence">${sentenceText}</p>`;
    document.body.appendChild(sentenceOverlay);

    // 2. Get positions of all characters in the sentence
    // We need to wait for render to get positions
    requestAnimationFrame(() => {
        const sentenceEl = sentenceOverlay.querySelector('.full-sentence');

        // Ensure sentence element exists
        if (!sentenceEl) return;

        const particleTargets = [];
        const textContent = sentenceText;

        const chars = textContent.split('');
        sentenceEl.innerHTML = ''; // Clear

        chars.forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.display = 'inline-block'; // Needed for transform
            if (char === ' ') span.style.width = '0.5em'; // Preserve spaces
            sentenceEl.appendChild(span);

            // Store reference for later
            particleTargets.push({
                char: char,
                element: span,
                rect: null // Will fill next
            });
        });

        // Force layout
        sentenceOverlay.offsetHeight;

        // Get positions
        particleTargets.forEach(target => {
            const rect = target.element.getBoundingClientRect();
            target.rect = rect;
            // Hide the element initially
            target.element.style.opacity = '0';
        });

        // Show overlay container (content is hidden)
        sentenceOverlay.style.opacity = '1';

        // 3. EXPLOSION!
        // Create a massive particle system at the center (where keywords are)
        const frozenCamera = camera.clone();
        frozenCamera.position.copy(camera.position);
        frozenCamera.quaternion.copy(camera.quaternion);
        frozenCamera.updateProjectionMatrix();
        frozenCamera.updateMatrixWorld();

        const centerPos = new THREE.Vector3(0, 0, -5).applyMatrix4(frozenCamera.matrixWorld);
        const planeNormal = new THREE.Vector3(0, 0, -1).applyQuaternion(frozenCamera.quaternion).normalize();
        const planeToCamera = new THREE.Vector3().subVectors(centerPos, frozenCamera.position);

        // Remove keyword meshes (they are already hidden, but remove from scene)
        matchedMeshes.forEach(mesh => {
            mesh.visible = false;
            if (removeMeshes) {
                if (mesh.parent) {
                    mesh.parent.remove(mesh);
                } else {
                    scene.remove(mesh);
                }
            }
        });

        // Create particles
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const color1 = new THREE.Color(0x5BC0BE); // Cyan
        const color2 = new THREE.Color(0xFFFFFF); // White

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = centerPos.x + (Math.random() - 0.5) * 1;
            positions[i * 3 + 1] = centerPos.y + (Math.random() - 0.5) * 1;
            positions[i * 3 + 2] = centerPos.z + (Math.random() - 0.5) * 1;

            const mixedColor = color1.clone().lerp(color2, Math.random());
            colors[i * 3] = mixedColor.r;
            colors[i * 3 + 1] = mixedColor.g;
            colors[i * 3 + 2] = mixedColor.b;

            sizes[i] = Math.random() * 0.04 + 0.01;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const particleSystem = new THREE.Points(geometry, material);
        scene.add(particleSystem);

        // Animate Explosion - Non-linear expansion
        // We'll use a custom animation object to drive the positions
        const targetCount = Math.max(1, particleTargets.length);
        const targetOrder = [];
        while (targetOrder.length < particleCount) {
            const block = Array.from({ length: targetCount }, (_, i) => i);
            for (let j = block.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [block[j], block[k]] = [block[k], block[j]];
            }
            targetOrder.push(...block);
        }

        const particleData = [];
        for (let i = 0; i < particleCount; i++) {
            // Random explosion direction
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const speed = speedMin + Math.random() * (speedMax - speedMin);

            particleData.push({
                vx: speed * Math.sin(phi) * Math.cos(theta),
                vy: speed * Math.sin(phi) * Math.sin(theta),
                vz: speed * Math.cos(phi),
                x: positions[i * 3],
                y: positions[i * 3 + 1],
                z: positions[i * 3 + 2],
                targetIndex: targetOrder[i] // Evenly distributed target letters
            });
        }

        // Animation Loop for Particles
        let startTime = performance.now();
        let lastTime = startTime;

        function updateParticles() {
            const now = performance.now();
            const elapsed = (now - startTime) / 1000;
            const delta = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            const positions = particleSystem.geometry.attributes.position.array;

            if (elapsed < 1.5) {
                // Phase 1: Explode Outward
                for (let i = 0; i < particleCount; i++) {
                    const data = particleData[i];
                    // Drag effect (time-based)
                    const drag = Math.pow(explosionDrag, delta);
                    data.vx *= drag;
                    data.vy *= drag;
                    data.vz *= drag;

                    data.x += data.vx * delta * approachSpeed;
                    data.y += data.vy * delta * approachSpeed;
                    data.z += data.vz * delta * approachSpeed;

                    positions[i * 3] = data.x;
                    positions[i * 3 + 1] = data.y;
                    positions[i * 3 + 2] = data.z;
                }
            } else if (elapsed < 4.0) {
                // Phase 2: Converge to Text
                const t = (elapsed - 1.5) / 2.5; // 0 to 1
                const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Ease in out
                const lerpFactor = 1 - Math.exp(-6 * delta);

                for (let i = 0; i < particleCount; i++) {
                    const data = particleData[i];
                    const target = particleTargets[data.targetIndex];

                    if (!target || !target.rect) continue;

                    // Convert 2D screen rect to 3D world position
                    // Normalized Device Coordinates (-1 to +1)
                    const ndcX = (target.rect.left + target.rect.width / 2) / window.innerWidth * 2 - 1;
                    const ndcY = -((target.rect.top + target.rect.height / 2) / window.innerHeight) * 2 + 1;

                    // Unproject
                    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
                    vector.unproject(frozenCamera);
                    const dir = vector.sub(frozenCamera.position).normalize();

                    const denom = dir.dot(planeNormal);
                    if (Math.abs(denom) < 1e-4) continue;

                    const distanceToPlane = planeToCamera.dot(planeNormal) / denom;
                    const targetPos = frozenCamera.position.clone().add(dir.multiplyScalar(distanceToPlane));

                    // Add some jitter within the letter rect
                    const vFOV = THREE.MathUtils.degToRad(frozenCamera.fov);
                    const planeDistance = Math.abs(planeToCamera.dot(planeNormal));
                    const visibleHeight = 2 * Math.tan(vFOV / 2) * planeDistance;
                    const scale = visibleHeight / window.innerHeight;

                    if (data.jitterX === undefined) data.jitterX = (Math.random() - 0.5);
                    if (data.jitterY === undefined) data.jitterY = (Math.random() - 0.5);
                    const jitterX = data.jitterX * target.rect.width * scale;
                    const jitterY = data.jitterY * target.rect.height * scale;

                    targetPos.x += jitterX;
                    targetPos.y += jitterY;

                    // Lerp current pos to target pos
                    positions[i * 3] += (targetPos.x - positions[i * 3]) * lerpFactor;
                    positions[i * 3 + 1] += (targetPos.y - positions[i * 3 + 1]) * lerpFactor;
                    positions[i * 3 + 2] += (targetPos.z - positions[i * 3 + 2]) * lerpFactor;

                    // Initialize drift velocity if not set
                    if (!data.driftVx) {
                        data.driftVx = (Math.random() - 0.5) * 1.2;
                        data.driftVy = (Math.random() - 0.5) * 1.2;
                        data.driftVz = (Math.random() - 0.5) * 1.2;
                    }
                }
            } else {
                // Phase 3: Drift (Keep particles visible while reading)
                for (let i = 0; i < particleCount; i++) {
                    const data = particleData[i];

                    // Apply gentle drift
                    positions[i * 3] += data.driftVx * delta * scatterSpeed;
                    positions[i * 3 + 1] += data.driftVy * delta * scatterSpeed;
                    positions[i * 3 + 2] += data.driftVz * delta * scatterSpeed;
                }
            }

            particleSystem.geometry.attributes.position.needsUpdate = true;

            // At 4 seconds (when particles have converged), fade in the text
            if (elapsed > 4.0 && !particleSystem.userData.textShown) {
                particleSystem.userData.textShown = true;

                // Stagger fade in letters
                particleTargets.forEach((target, i) => {
                    gsap.to(target.element, {
                        opacity: 1,
                        duration: 0.5,
                        delay: i * 0.02
                    });
                });

                if (onTextShown) {
                    onTextShown(sentenceOverlay, blurOverlay, particleSystem);
                }
            }

            // At 5 seconds (text fully visible), slowly fade in blur
            if (elapsed > 5.0 && !particleSystem.userData.blurStarted && enableBlur) {
                particleSystem.userData.blurStarted = true;

                // Create blur overlay if it doesn't exist
                if (!blurOverlay) {
                    blurOverlay = document.createElement('div');
                    blurOverlay.id = 'unlock-blur-overlay';
                    blurOverlay.className = 'unlock-blur-overlay';
                    blurOverlay.style.opacity = '0';
                    document.body.appendChild(blurOverlay);
                }

                // Slowly fade in blur over 2 seconds
                gsap.to(blurOverlay, {
                    opacity: 1,
                    duration: 2,
                    ease: "power2.inOut"
                });
            }

            if (elapsed > fadeStart) {
                const fadeProgress = Math.min((elapsed - fadeStart) / fadeDuration, 1);
                particleSystem.material.opacity = 1 - fadeProgress;
            }

            if (particleSystem.material.opacity > 0.02) {
                requestAnimationFrame(updateParticles);
            } else {
                // Animation Done - remove particles
                scene.remove(particleSystem);
            }

            // Trigger next step at 12 seconds (text at 4s + blur at 5s + 5s reading time)
            if (elapsed > completeAfter && !particleSystem.userData.triggered) {
                particleSystem.userData.triggered = true;

                // Proceed to next phase (blur already at full opacity)
                onComplete(sentenceOverlay, blurOverlay);
            }
        }

        updateParticles();
    });
}

function transformSentenceToTitle(project, sentenceOverlay, blurOverlay) {
    // 1. Explode Sentence
    const letters = sentenceOverlay.querySelectorAll('span');
    letters.forEach(span => {
        const rect = span.getBoundingClientRect();
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const dirX = (rect.left - centerX);
        const dirY = (rect.top - centerY);

        gsap.to(span, {
            x: dirX * 2 + (Math.random() - 0.5) * 500,
            y: dirY * 2 + (Math.random() - 0.5) * 500,
            opacity: 0,
            rotation: Math.random() * 360,
            duration: 1.5,
            ease: "power2.in",
            onComplete: () => {
                // Remove sentence overlay after animation
                if (sentenceOverlay && sentenceOverlay.parentNode) {
                    sentenceOverlay.remove();
                }
            }
        });
    });

    // 2. Unblur field briefly (as requested)
    if (blurOverlay) {
        gsap.to(blurOverlay, { opacity: 0.2, duration: 0.5 });
    }

    // 3. Rotate/Rearrange field keywords (Visual chaos)
    keywordGroup.children.forEach(mesh => {
        gsap.to(mesh.rotation, {
            x: Math.random() * Math.PI * 2,
            y: Math.random() * Math.PI * 2,
            duration: 2
        });
        gsap.to(mesh.position, {
            x: (Math.random() - 0.5) * WORLD_SIZE,
            y: (Math.random() - 0.5) * WORLD_SIZE,
            z: (Math.random() - 0.5) * WORLD_SIZE,
            duration: 2
        });
    });

    // 4. Assemble Title
    // Create Title Overlay
    const nameOverlay = document.createElement('div');
    nameOverlay.id = 'project-name-reveal';
    nameOverlay.className = 'project-name-reveal';
    // Split title into words for animation
    const titleWords = project.name.split(' ');
    const titleHTML = titleWords.map(word => `<span class="title-word">${word}</span>`).join(' ');
    nameOverlay.innerHTML = `<h1 class="project-title-reveal">${titleHTML}</h1>`;
    document.body.appendChild(nameOverlay);

    // Style for animation
    const titleReveal = nameOverlay.querySelector('.project-title-reveal');
    titleReveal.style.opacity = '1'; // Container visible

    const wordElements = nameOverlay.querySelectorAll('.title-word');
    wordElements.forEach((el, i) => {
        // Start from off-screen random positions
        const angle = Math.random() * Math.PI * 2;
        const dist = 1000;
        const startX = Math.cos(angle) * dist;
        const startY = Math.sin(angle) * dist;

        gsap.fromTo(el,
            {
                x: startX,
                y: startY,
                rotation: Math.random() * 180 - 90,
                opacity: 0
            },
            {
                x: 0,
                y: 0,
                rotation: 0,
                opacity: 1,
                duration: 1.5,
                delay: 1.5 + i * 0.2, // Wait for sentence explosion
                ease: "power3.out"
            }
        );
    });

    // 5. Create blur overlay now (for scroll phase) if not exists
    if (!blurOverlay) {
        blurOverlay = document.createElement('div');
        blurOverlay.id = 'unlock-blur-overlay';
        blurOverlay.className = 'unlock-blur-overlay';
        blurOverlay.style.opacity = '0';
        document.body.appendChild(blurOverlay);

        // Fade in blur
        gsap.to(blurOverlay, { opacity: 1, duration: 1, delay: 2 });
    } else {
        // Re-blur field
        gsap.to(blurOverlay, { opacity: 1, duration: 1, delay: 2 });
    }

    // 6. Proceed to Scroll Phase
    // Remove sentence overlay before scroll phase to prevent blocking
    setTimeout(() => {
        if (sentenceOverlay && sentenceOverlay.parentNode) {
            sentenceOverlay.remove();
        }
    }, 2000);

    setTimeout(() => {
        setupScrollDrivenTransition(project, nameOverlay, blurOverlay);
    }, 3500);
}

function showCompleteSentence(project, matchedMeshes, blurOverlay) {
    // Deprecated - replaced by explodeKeywordsToSentence
}

function dissolveSentenceToName(project, sentenceOverlay, blurOverlay) {
    // Deprecated - replaced by transformSentenceToTitle
}

function showProjectNameWithParticles(project, blurOverlay) {
    // Deprecated - replaced by transformSentenceToTitle
}


// Scroll-driven title animation (like paprikawang)
function setupScrollDrivenTransition(project, nameOverlay, blurOverlay) {
    console.log('setupScrollDrivenTransition called');

    // Keep body locked while we use a temporary scroll driver
    document.body.style.overflow = 'hidden';

    // Add scroll hint
    const scrollHint = document.createElement('div');
    scrollHint.className = 'scroll-hint';
    scrollHint.innerHTML = `
        <div class="scroll-hint-text">SCROLL TO CONTINUE</div>
        <div class="scroll-hint-arrow">↓</div>
    `;
    document.body.appendChild(scrollHint);

    // Animate scroll hint in
    gsap.fromTo(scrollHint,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.5 }
    );

    // Get title element for scale animation
    const titleReveal = nameOverlay.querySelector('.project-title-reveal');

    // Compute scale target to fully cover the viewport
    const titleRect = titleReveal.getBoundingClientRect();
    const coverScale = Math.max(
        window.innerWidth / Math.max(titleRect.width, 1),
        window.innerHeight / Math.max(titleRect.height, 1)
    );
    const targetScale = coverScale * 1.8;
    const targetOpacity = 0;

    // Create a real scroll container so wheel + touch both work reliably
    const scrollDriver = document.createElement('div');
    scrollDriver.id = 'scroll-driver';
    scrollDriver.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow-y: scroll;
        overflow-x: hidden;
        z-index: 54;
        background: transparent;
        pointer-events: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
    `;

    const scrollSpacer = document.createElement('div');
    scrollSpacer.className = 'scroll-driver-spacer';
    scrollDriver.appendChild(scrollSpacer);
    document.body.appendChild(scrollDriver);

    console.log('Scroll driver created and added to DOM');

    // Total scroll amount needed (virtual)
    const totalScrollNeeded = window.innerHeight * 1.2;
    let animationComplete = false;
    let titleInPosition = false;
    scrollSpacer.style.height = `${totalScrollNeeded + window.innerHeight}px`;

    // Wait for next frame to ensure element is rendered
    requestAnimationFrame(() => {
        const maxScroll = scrollDriver.scrollHeight - scrollDriver.clientHeight;
        console.log('Scroll driver ready. scrollHeight:', scrollDriver.scrollHeight, 'clientHeight:', scrollDriver.clientHeight, 'maxScroll:', maxScroll);

        // Prepare project detail view content (hidden)
        const detailView = document.getElementById('project-detail-view');
        const titleEl = detailView.querySelector('.project-detail-title');
        const yearEl = detailView.querySelector('.project-detail-year');
        const typeEl = detailView.querySelector('.project-detail-type');
        const contentEl = detailView.querySelector('.project-detail-content');
        const keywordsEl = detailView.querySelector('.project-detail-keywords');
        const coverImageEl = detailView.querySelector('.project-cover-image');
        const linksEl = detailView.querySelector('.project-links');

        if (!titleEl || !yearEl || !typeEl || !contentEl || !keywordsEl) {
            console.error('Required project detail elements not found!');
            return;
        }

        titleEl.textContent = project.name;
        yearEl.textContent = project.year || '';
        typeEl.textContent = project.type || '';

        // Populate Content (description first, then content)
        const descriptionHtml = project.description ? `<p>${project.description}</p>` : '';
        const contentHtml = project.content ? project.content : '';
        contentEl.innerHTML = `${descriptionHtml}${contentHtml}`;

        // Populate Links
        if (linksEl) {
            linksEl.innerHTML = '';
            if (project.links && project.links.length > 0) {
                linksEl.style.display = 'flex';
                project.links.forEach(link => {
                    const a = document.createElement('a');
                    a.href = link.url;
                    a.textContent = link.label;
                    a.target = '_blank';
                    a.className = 'project-link-item';
                    linksEl.appendChild(a);
                });
            } else {
                linksEl.style.display = 'none';
            }
        }

        // Show cover image
        if (coverImageEl && project.image) {
            coverImageEl.src = project.image;
            coverImageEl.style.display = 'block';
        } else if (coverImageEl) {
            coverImageEl.src = '';
            coverImageEl.style.display = 'none';
        }

        // Scroll handler - directly drive the animation
        function onScroll() {
            if (animationComplete) return;

            const rawProgress = maxScroll > 0 ? (scrollDriver.scrollTop / maxScroll) : 1;
            const progress = Math.max(0, Math.min(rawProgress, 1));
            const easedProgress = easeInOutCubic(progress);

            console.log('Scroll event - scrollTop:', scrollDriver.scrollTop, 'progress:', progress.toFixed(3));

            // Fade out scroll hint as user scrolls
            if (progress > 0 && progress < 0.3) {
                scrollHint.style.opacity = String(1 - (progress / 0.3));
            } else if (progress >= 0.3) {
                scrollHint.style.opacity = '0';
            }

            // Interpolate scale + opacity for "coming toward viewer" effect
            const currentScale = 1 + (targetScale - 1) * easedProgress;
            const currentOpacity = 1 + (targetOpacity - 1) * easedProgress;
            const driftY = 90 * easedProgress - 24;

            nameOverlay.style.transform = `translate(-50%, -50%) scale(${currentScale}) translateY(${driftY}px)`;
            nameOverlay.style.opacity = String(currentOpacity);

            // When title reaches position, complete animation
            if (progress >= 0.95 && !titleInPosition) {
                titleInPosition = true;
                animationComplete = true;

                console.log('Title animation complete!');

                // Lock title in final state
                nameOverlay.style.transform = `translate(-50%, -50%) scale(${targetScale}) translateY(66px)`;
                nameOverlay.style.opacity = '0';

                // Start content slide-in animation
                scrollDriver.removeEventListener('scroll', onScroll);
                completeScrollTransition(project, nameOverlay, blurOverlay, scrollDriver, scrollHint, detailView, titleEl);
            }
        }

        scrollDriver.addEventListener('scroll', onScroll, { passive: true });
        console.log('Scroll listener attached');
        onScroll(); // Initial call
    });
}

function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}


function completeScrollTransition(project, nameOverlay, blurOverlay, scrollDriver, scrollHint, detailView, titleEl) {
    // Remove scroll hint
    if (scrollHint) scrollHint.remove();

    // Remove scroll driver if it exists
    if (scrollDriver) scrollDriver.remove();

    // Keep title hidden after it blows past the screen
    nameOverlay.style.opacity = '0';
    nameOverlay.style.pointerEvents = 'none';

    // Fade out blur overlay
    if (blurOverlay) {
        gsap.to(blurOverlay, {
            opacity: 0,
            duration: 0.4,
            onComplete: () => blurOverlay.remove()
        });
    }

    // Show detail view background first
    detailView.classList.remove('hidden');
    detailView.style.opacity = '0';
    detailView.style.pointerEvents = 'auto'; // IMPORTANT: Enable pointer events

    // Prepare content elements for slide-up animation
    const container = detailView.querySelector('.project-detail-container');
    const backButton = container.querySelector('.back-button');
    const header = container.querySelector('.project-detail-header');
    const body = container.querySelector('.project-detail-body');

    // Set initial states for slide-up (start below viewport)
    gsap.set([backButton, header, body], {
        opacity: 0,
        y: 60
    });

    // Fade in view background quickly
    gsap.to(detailView, {
        opacity: 1,
        duration: 0.3,
        onComplete: () => {
            // Slide up content elements with stagger - this is the main animation
            gsap.to(backButton, {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: "power2.out"
            });

            gsap.to(header, {
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay: 0.05,
                ease: "power2.out"
            });

            gsap.to(body, {
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay: 0.1,
                ease: "power2.out",
                onComplete: () => {
                    // After all content is in place, cross-fade titles
                    titleEl.style.opacity = '1';
                    titleEl.style.transition = 'opacity 0.3s ease';

                    gsap.to(nameOverlay, {
                        opacity: 0,
                        duration: 0.3,
                        onComplete: () => {
                            nameOverlay.remove();

                            // Update state
                            state.view = 'projectDetail';
                            state.currentProjectDetail = project;
                            state.fieldPhase = 'projectReveal';

                            // Save project as collected
                            state.collectedProjects[project.id] = {
                                project: project,
                                usedKeywords: [...state.collectedWords]
                            };
                            saveCollectedProjects();
                            create3DGallery();
                            clearCollectedKeywords();

                            // Keep canvas visible
                            document.getElementById('canvas-container').style.opacity = '0.7';

                            updateVisibility();
                        }
                    });
                }
            });
        }
    });
}

function transitionToProjectDetail(project, nameOverlay, blurOverlay) {
    // This function is now replaced by scroll-driven transition
    // Keeping for compatibility but redirecting to new system
    setupScrollDrivenTransition(project, nameOverlay, blurOverlay);
}

// --- Project Detail View ---

function showProjectDetail(project) {
    // Remember where we came from - only if we're not already in projectDetail
    if (state.view !== 'projectDetail') {
        state.previousView = state.view;
    }

    state.view = 'projectDetail';
    state.currentProjectDetail = project;
    state.fieldPhase = 'projectReveal';

    // Update the project detail view HTML
    const detailView = document.getElementById('project-detail-view');
    const titleEl = detailView.querySelector('.project-detail-title');
    const yearEl = detailView.querySelector('.project-detail-year');
    const typeEl = detailView.querySelector('.project-detail-type');
    const contentEl = detailView.querySelector('.project-detail-content');
    const keywordsEl = detailView.querySelector('.project-detail-keywords');
    const coverImageEl = detailView.querySelector('.project-cover-image');
    const linksEl = detailView.querySelector('.project-links');

    titleEl.textContent = project.name;
    yearEl.textContent = project.year || '';
    typeEl.textContent = project.type || '';

    // Populate Content (description first, then content)
    const descriptionHtml = project.description ? `<p>${project.description}</p>` : '';
    const contentHtml = project.content ? project.content : '';
    contentEl.innerHTML = `${descriptionHtml}${contentHtml}`;

    // Populate Links
    linksEl.innerHTML = '';
    if (project.links && project.links.length > 0) {
        linksEl.style.display = 'flex';
        project.links.forEach(link => {
            const a = document.createElement('a');
            a.href = link.url;
            a.textContent = link.label;
            a.target = '_blank';
            a.className = 'project-link-item';
            linksEl.appendChild(a);
        });
    } else {
        linksEl.style.display = 'none';
    }

    // Show cover image
    if (project.image) {
        coverImageEl.src = project.image;
        coverImageEl.style.display = 'block';
    } else {
        coverImageEl.src = '';
        coverImageEl.style.display = 'none';
    }

    // Show keywords used to unlock
    const usedKeywords = state.collectedProjects[project.id]?.usedKeywords || state.collectedWords;
    keywordsEl.innerHTML = usedKeywords.map(k => `<span class="detail-keyword">${k}</span>`).join('');

    // Hide Gallery view so it doesn't show through the blur
    ui.views.gallery.classList.add('hidden');
    // Clear only visibility-related inline styles that might override the class
    ui.views.gallery.style.visibility = '';
    ui.views.gallery.style.opacity = '';
    ui.views.gallery.style.pointerEvents = '';

    // Keep canvas at 0.7 so the blur effect looks good
    document.getElementById('canvas-container').style.opacity = '0.7';
    document.getElementById('canvas-container').style.pointerEvents = 'none';

    // Show the view - ensure it's scrollable
    detailView.classList.remove('hidden');
    detailView.style.pointerEvents = 'auto';
    detailView.scrollTop = 0; // Reset scroll position

    updateVisibility();
}

function hideProjectDetail() {
    const detailView = document.getElementById('project-detail-view');
    detailView.classList.add('hidden');
    detailView.style.pointerEvents = 'none';

    // Clear current project detail state
    state.currentProjectDetail = null;

    // Return to previous view
    if (state.previousView === 'gallery') {
        state.view = 'gallery';
        state.fieldPhase = 'active';

        // Get gallery element directly and show it
        const galleryEl = document.getElementById('gallery-view');
        galleryEl.classList.remove('hidden');

        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        if (ui.nav.gallery) ui.nav.gallery.classList.add('active');

        // Keep canvas fully visible for collected item clarity
        document.getElementById('canvas-container').style.opacity = '1';
        document.getElementById('canvas-container').style.pointerEvents = 'auto';

        // Make sure gallery group is visible
        if (galleryGroup) {
            galleryGroup.visible = true;
        }

        gsap.to(camera.position, {
            x: 0, y: 0, z: 12,
            duration: 0.8,
            ease: "power2.inOut"
        });
        gsap.to(camera.rotation, {
            x: 0, y: 0, z: 0,
            duration: 0.8,
            ease: "power2.inOut"
        });

        animateGalleryItemBack();

        renderGallery();
    } else {
        // Restore canvas for Field view
        document.getElementById('canvas-container').style.opacity = '1';
        document.getElementById('canvas-container').style.pointerEvents = 'auto';
        // Return to field
        returnToField({ resetSelection: true });
    }
}

function returnToField({ resetSelection = false } = {}) {
    state.view = 'field';
    state.fieldPhase = 'active';
    state.currentProjectDetail = null;
    state.currentUnlockingProject = null;

    if (resetSelection) {
        clearCollectedKeywords();
    }

    updateVisibility();
    maybeTriggerFinale();
}

function clearCollectedKeywords() {
    // Reset all selected keywords
    state.collectedKeywords.forEach(mesh => {
        mesh.visible = true;
        mesh.userData.selected = false;
        mesh.userData.fixed = false;
        mesh.userData.hinted = false;

        // Reset appearance
        mesh.material.color.setHex(0xffffff);
        gsap.to(mesh.material, { opacity: 0.6, duration: 0.5 });
    });

    // Clear arrays
    state.collectedKeywords = [];
    state.collectedWords = [];
    state.findYourself.selectedWords = [];
    state.findYourself.selectedMeshes = [];
    state.findYourself.sequenceActive = false;

    // Remove old state lines (if any)
    state.lines.forEach(line => scene.remove(line));
    state.lines = [];

    // Clear hint lines
    clearHintLines();

    // Update bottom bar
    updateBottomBar();

    // Reset all keywords appearance
    keywordGroup.children.forEach(mesh => {
        mesh.userData.hinted = false;
        if (mesh.userData.userWord && mesh.userData.selected) {
            mesh.userData.selected = false;
            mesh.material.color.setHex(0xffffff);
        }
        if (!mesh.userData.selected) {
            gsap.to(mesh.material, { opacity: 0.6, duration: 1 });
        }
    });
}

// --- UI Logic ---
const ui = {
    nav: {
        about: document.getElementById('nav-about'),
        field: document.getElementById('nav-field'),
        gallery: document.getElementById('nav-gallery'),
        menu: document.getElementById('nav-menu')
    },
    views: {
        field: document.getElementById('canvas-container'),
        gallery: document.getElementById('gallery-view'),
        about: document.getElementById('about-view'),
        projectDetail: document.getElementById('project-detail-view')
    },
    overlays: {
        menu: document.getElementById('side-menu'),
        contact: document.getElementById('contact-overlay'),
        find: document.getElementById('find-overlay')
    },
    menuItems: {
        home: document.getElementById('menu-home'),
        about: document.getElementById('menu-about'),
        find: document.getElementById('menu-find'),
        contact: document.getElementById('menu-contact'),
        reset: document.getElementById('menu-reset'),
        close: document.getElementById('menu-close')
    },
    inputs: {
        contactClose: document.getElementById('contact-close'),
        projectDetailBack: document.getElementById('project-detail-back'),
        findInput: document.getElementById('find-input'),
        findAdd: document.getElementById('find-add'),
        findStart: document.getElementById('find-start'),
        findCancel: document.getElementById('find-cancel')
    },
    containers: {
        canvas: document.getElementById('canvas-container'),
        uiLayer: document.getElementById('ui-layer'),
        collectedBar: document.getElementById('collected-keywords-bar'),
        findWords: document.getElementById('find-words')
    }
};

function splitFindInput(value) {
    const hasSeparators = /[,\n;]/.test(value);
    if (!hasSeparators) return [value];
    return value.split(/[,\n;]+/);
}

function renderFindWordsList() {
    const container = ui.containers.findWords;
    if (!container) return;

    container.innerHTML = '';
    state.findYourself.inputWords.forEach(item => {
        const pill = document.createElement('span');
        pill.className = 'find-word-pill';
        pill.textContent = item.raw;
        pill.dataset.key = item.key;
        pill.title = 'Remove';
        container.appendChild(pill);
    });

    if (ui.inputs.findStart) {
        ui.inputs.findStart.disabled = state.findYourself.inputWords.length < 3;
    }
}

function addFindWordsFromInput() {
    const input = ui.inputs.findInput;
    if (!input) return;

    const raw = input.value.trim();
    if (!raw) return;

    const parts = splitFindInput(raw);
    parts.forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        const key = normalizeWord(trimmed);
        if (!key) return;
        if (state.findYourself.inputWords.some(item => item.key === key)) return;
        state.findYourself.inputWords.push({ raw: trimmed, key });
    });

    input.value = '';
    renderFindWordsList();
}

function openFindOverlay() {
    if (!ui.overlays.find) return;
    ui.overlays.find.classList.remove('hidden');
    renderFindWordsList();
    if (ui.inputs.findInput) {
        ui.inputs.findInput.focus();
    }
}

function closeFindOverlay() {
    if (!ui.overlays.find) return;
    ui.overlays.find.classList.add('hidden');
}

function startFindYourselfFromOverlay() {
    if (state.findYourself.inputWords.length < 3) return;

    const words = state.findYourself.inputWords.map(item => item.raw);
    applyFindWordsToField(words);
    state.findYourself.inputWords = [];
    renderFindWordsList();
    closeFindOverlay();

    switchView('field');
    if (state.fieldPhase === 'landing' || state.fieldPhase === 'shattering') {
        state.fieldPhase = 'active';
        keywordGroup.children.forEach(mesh => {
            gsap.to(mesh.material, { opacity: 0.6, duration: 1.2 });
        });
    }
    updateVisibility();
}

function updateVisibility() {
    const landingTitle = document.getElementById('landing-title');

    // 1. Handle HTML Title Visibility
    if (state.view === 'field' && state.fieldPhase === 'landing') {
        landingTitle.style.opacity = '1';
        landingTitle.style.pointerEvents = 'auto';
        landingTitle.style.transform = 'translate(-50%, -50%) scale(1)';
    } else {
        landingTitle.style.opacity = '0';
        landingTitle.style.pointerEvents = 'none';
    }

    // 2. Handle 3D Keywords Visibility
    // Keywords should only be visible if we are in Field View AND Field Phase is active (or unlocking)
    const showKeywords = (state.view === 'field' && (state.fieldPhase === 'active' || state.fieldPhase === 'unlocking' || state.fieldPhase === 'ending'));

    if (keywordGroup) {
        keywordGroup.visible = showKeywords;
    }

    // 3. Handle Particles Visibility
    // Particles are transient, but if we switch away, maybe hide them?
    if (particles) {
        particles.visible = (state.view === 'field');
    }
}

function switchView(viewName) {
    state.view = viewName;

    // Update Nav Active State
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (ui.nav[viewName]) ui.nav[viewName].classList.add('active');

    // Hide all views first - clear only visibility-related inline styles
    ui.views.gallery.classList.add('hidden');
    ui.views.gallery.style.visibility = '';
    ui.views.gallery.style.opacity = '';
    ui.views.gallery.style.pointerEvents = '';

    ui.views.about.classList.add('hidden');
    ui.views.about.style.visibility = '';
    ui.views.about.style.opacity = '';
    ui.views.about.style.pointerEvents = '';

    if (ui.views.projectDetail) {
        ui.views.projectDetail.classList.add('hidden');
        ui.views.projectDetail.style.visibility = '';
        ui.views.projectDetail.style.opacity = '';
        ui.views.projectDetail.style.pointerEvents = '';
    }

    // Reset Canvas Blur
    ui.containers.canvas.style.filter = 'none';

    // Handle collected bar visibility - only show in Field view
    const collectedBar = document.getElementById('collected-keywords-bar');
    if (collectedBar) {
        if (viewName === 'field') {
            collectedBar.classList.remove('hidden-view');
        } else {
            collectedBar.classList.add('hidden-view');
        }
    }

    // Handle specific views
    if (viewName === 'field') {
        // Show Canvas
        ui.containers.canvas.style.opacity = '1';
        ui.containers.canvas.style.pointerEvents = 'auto';
        gsap.to(camera.position, {
            x: 0, y: 0, z: 5,
            duration: 0.8,
            ease: "power2.inOut"
        });
        gsap.to(camera.rotation, {
            x: 0, y: 0, z: 0,
            duration: 0.8,
            ease: "power2.inOut"
        });
        setHintLinesVisible(true);
        // Ensure fieldPhase is active so keywords are visible
        // (unless we're in landing phase which shouldn't happen here)
        if (state.fieldPhase !== 'landing' && state.fieldPhase !== 'shattering') {
            state.fieldPhase = 'active';
        }
        // Hide 3D Gallery
        if (galleryGroup) {
            galleryGroup.visible = false;
        }
    } else if (viewName === 'gallery') {
        // Keep canvas fully visible for collected item clarity
        ui.containers.canvas.style.opacity = '1';
        ui.containers.canvas.style.pointerEvents = 'auto'; // Allow clicks for 3D gallery
        ui.views.gallery.classList.remove('hidden');
        setHintLinesVisible(false);

        // Show and reset 3D Gallery
        if (galleryGroup) {
            galleryGroup.visible = true;
            galleryRotation.current = 0;
            galleryRotation.velocity = 0;
            galleryAutoRotate = true;

            // Move camera back to view the floating grid
            gsap.to(camera.position, {
                x: 0, y: 0, z: 12,
                duration: 0.8,
                ease: "power2.inOut"
            });
            gsap.to(camera.rotation, {
                x: 0, y: 0, z: 0,
                duration: 0.8,
                ease: "power2.inOut"
            });
        }
    } else if (viewName === 'about') {
        ui.containers.canvas.style.opacity = '0.7';
        ui.containers.canvas.style.pointerEvents = 'none';
        ui.views.about.classList.remove('hidden');
        // Hide 3D Gallery
        if (galleryGroup) {
            galleryGroup.visible = false;
        }
    }

    updateVisibility();
}

// Back Button Listener - REMOVED
// document.getElementById('about-back').addEventListener('click', () => {
//     switchView('field');
// });

// Nav Listeners
ui.nav.about.addEventListener('click', (e) => {
    e.preventDefault();
    if (state.view === 'about') {
        // If already on About page, go back to Field
        switchView('field');
    } else {
        switchView('about');
    }
});

ui.nav.field.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('field');
});

ui.nav.gallery.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('gallery');
});

const MENU_TRANSITION_MS = 500;
let menuCloseTimer = null;

function openMenu() {
    if (menuCloseTimer) {
        clearTimeout(menuCloseTimer);
        menuCloseTimer = null;
    }
    ui.overlays.menu.classList.add('open');
    document.body.classList.add('menu-open');
}

function closeMenu() {
    ui.overlays.menu.classList.remove('open');
    if (menuCloseTimer) {
        clearTimeout(menuCloseTimer);
    }
    menuCloseTimer = setTimeout(() => {
        document.body.classList.remove('menu-open');
        menuCloseTimer = null;
    }, MENU_TRANSITION_MS);
}

function toggleMenu() {
    if (ui.overlays.menu.classList.contains('open')) {
        closeMenu();
    } else {
        openMenu();
    }
}

// Menu Listener
ui.nav.menu.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMenu();
});

// Menu Items Logic
ui.menuItems.home.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();

    // Reset to Field Landing
    switchView('field');
    state.fieldPhase = 'landing';
    state.collectedKeywords = []; // Clear collected
    state.collectedWords = []; // Clear collected words
    state.findYourself.selectedWords = [];
    state.findYourself.selectedMeshes = [];
    state.findYourself.sequenceActive = false;

    // Clear hint lines
    clearHintLines();

    // Reset Keywords
    keywordGroup.children.forEach(mesh => {
        mesh.userData.selected = false;
        mesh.userData.hovered = false;
        mesh.userData.hinted = false;
        mesh.material.opacity = 0; // Hide them
        mesh.material.color.setHex(0xffffff);
        mesh.position.copy(mesh.userData.originalPos);
        mesh.scale.set(1, 1, 1); // Reset scale
    });

    // Update bottom bar
    updateBottomBar();

    updateVisibility();
});

ui.menuItems.about.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    switchView('about');
});

ui.menuItems.find.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    openFindOverlay();
});

ui.menuItems.contact.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    ui.overlays.contact.classList.remove('hidden');
});

ui.menuItems.reset.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Clear gallery progress? This action cannot be undone.')) {
        resetCollectedProjects();
        closeMenu();
        switchView('field');
    }
});

ui.menuItems.close.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
});

ui.inputs.contactClose.addEventListener('click', () => {
    ui.overlays.contact.classList.add('hidden');
});

if (ui.inputs.findAdd) {
    ui.inputs.findAdd.addEventListener('click', () => {
        addFindWordsFromInput();
    });
}

if (ui.inputs.findInput) {
    ui.inputs.findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addFindWordsFromInput();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeFindOverlay();
        }
    });
}

if (ui.inputs.findStart) {
    ui.inputs.findStart.addEventListener('click', () => {
        startFindYourselfFromOverlay();
    });
}

if (ui.inputs.findCancel) {
    ui.inputs.findCancel.addEventListener('click', () => {
        closeFindOverlay();
    });
}

if (ui.containers.findWords) {
    ui.containers.findWords.addEventListener('click', (e) => {
        const pill = e.target.closest('.find-word-pill');
        if (!pill) return;
        const key = pill.dataset.key;
        state.findYourself.inputWords = state.findYourself.inputWords.filter(item => item.key !== key);
        renderFindWordsList();
    });
}

// Project Detail Back Button
ui.inputs.projectDetailBack.addEventListener('click', () => {
    hideProjectDetail();
});

// Close menu when clicking outside (optional, but good UX)
document.addEventListener('click', (e) => {
    if (!ui.overlays.menu.contains(e.target) && e.target !== ui.nav.menu) {
        closeMenu();
    }
});

// --- 3D Gallery System ---
let galleryGroup = null;
let galleryItems = [];
let galleryRotation = { current: 0, velocity: 0 };
let galleryAutoRotate = true;
let galleryTransition = null;

// Gallery layout - floating wall grid with gentle depth curvature
const GALLERY_SPACING_X = 5.4;
const GALLERY_SPACING_Y = 3.8;
const GALLERY_CARD_BASE_WIDTH = 3.6;
const GALLERY_CARD_BASE_HEIGHT = 2.3;
const GALLERY_CARD_MAX_WIDTH = 4.6;
const GALLERY_CARD_MAX_HEIGHT = 3.1;

function createGlowPlane(width, height) {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 512;
    glowCanvas.height = 512;
    const glowCtx = glowCanvas.getContext('2d');

    const centerX = 256;
    const centerY = 256;

    const planeWidth = width * 1.6;
    const planeHeight = height * 1.6;
    const rectWidth = (width / planeWidth) * glowCanvas.width;
    const rectHeight = (height / planeHeight) * glowCanvas.height;

    const drawGlow = (blur, color, lineWidth) => {
        glowCtx.shadowBlur = blur;
        glowCtx.shadowColor = color;
        glowCtx.strokeStyle = color;
        glowCtx.lineWidth = lineWidth;
        glowCtx.strokeRect(centerX - rectWidth / 2, centerY - rectHeight / 2, rectWidth, rectHeight);
        glowCtx.strokeRect(centerX - rectWidth / 2, centerY - rectHeight / 2, rectWidth, rectHeight);
    };

    drawGlow(90, 'rgba(0, 255, 204, 0.25)', 4);
    drawGlow(50, 'rgba(0, 255, 204, 0.45)', 4);
    drawGlow(18, 'rgba(0, 255, 204, 0.9)', 3);
    drawGlow(6, 'rgba(200, 255, 240, 0.95)', 2);

    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    return new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), glowMaterial);
}

function setGlowPlane(group, width, height, isCollected) {
    if (group.userData.glowPlane) {
        group.remove(group.userData.glowPlane);
        group.userData.glowPlane.geometry.dispose();
        group.userData.glowPlane.material.dispose();
        group.userData.glowPlane = null;
    }

    if (!isCollected) return;

    const glowPlane = createGlowPlane(width, height);
    glowPlane.position.z = -0.02;
    group.add(glowPlane);
    group.userData.glowPlane = glowPlane;
}

function applyCardSize(group, width, height) {
    group.userData.cardSize = { width, height };

    group.userData.card.geometry.dispose();
    group.userData.card.geometry = new THREE.PlaneGeometry(width, height);

    group.userData.border.geometry.dispose();
    group.userData.border.geometry = new THREE.EdgesGeometry(group.userData.card.geometry);

    const innerWidth = width * 0.96;
    const innerHeight = height * 0.96;

    if (group.userData.textPlane) {
        group.userData.textPlane.geometry.dispose();
        group.userData.textPlane.geometry = new THREE.PlaneGeometry(width * 0.9, height * 0.6);
    }

    if (group.userData.coverImage) {
        group.userData.coverImage.geometry.dispose();
        group.userData.coverImage.geometry = new THREE.PlaneGeometry(innerWidth, innerHeight);
    }

    if (group.userData.maskPlane) {
        group.userData.maskPlane.geometry.dispose();
        group.userData.maskPlane.geometry = new THREE.PlaneGeometry(innerWidth, innerHeight);
    }

    setGlowPlane(group, width, height, group.userData.isCollected);
}

function createGalleryCard(project, position) {
    const group = new THREE.Group();

    const isCollected = !!state.collectedProjects[project.id];

    // Card background with glow effect
    const cardGeometry = new THREE.PlaneGeometry(GALLERY_CARD_BASE_WIDTH, GALLERY_CARD_BASE_HEIGHT);
    const cardMaterial = new THREE.MeshBasicMaterial({
        color: isCollected ? 0x0c2a30 : 0x0a1a1e,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    });
    const card = new THREE.Mesh(cardGeometry, cardMaterial);
    group.add(card);

    // Card border with glow effect for collected projects
    const borderGeometry = new THREE.EdgesGeometry(cardGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({
        color: isCollected ? 0x8fffe6 : 0x408F98,
        transparent: true,
        opacity: 0
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    group.add(border);

    let glowPlane = null;
    if (isCollected) {
        glowPlane = createGlowPlane(GALLERY_CARD_BASE_WIDTH, GALLERY_CARD_BASE_HEIGHT);
        glowPlane.position.z = -0.02;
        glowPlane.material.opacity = 0;
        group.add(glowPlane);
    }

    // Create title texture with canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = '600 32px "Azeret Mono", monospace';
    ctx.fillStyle = '#e3e4ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const name = project.name;
    if (name.length > 15) {
        ctx.font = '600 24px "Azeret Mono", monospace';
    }
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);

    ctx.font = '200 16px "Azeret Mono", monospace';
    ctx.fillStyle = '#408F98';
    ctx.fillText(project.year || '', canvas.width / 2, canvas.height / 2 + 40);

    const textTexture = new THREE.CanvasTexture(canvas);
    textTexture.needsUpdate = true;

    const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const textPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(GALLERY_CARD_BASE_WIDTH * 0.9, GALLERY_CARD_BASE_HEIGHT * 0.6),
        textMaterial
    );
    textPlane.position.z = 0.01;
    group.add(textPlane);
    group.userData.textPlane = textPlane;

    const maskMaterial = new THREE.MeshBasicMaterial({
        color: 0x0f1a1d,
        transparent: true,
        opacity: 0.97,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const maskPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(GALLERY_CARD_BASE_WIDTH * 0.96, GALLERY_CARD_BASE_HEIGHT * 0.96),
        maskMaterial
    );
    maskPlane.position.z = 0.03;
    maskPlane.visible = !isCollected;
    group.add(maskPlane);

    group.userData = {
        project: project,
        basePosition: position.clone(),
        floatSeed: Math.random() * Math.PI * 2,
        card: card,
        border: border,
        glowPlane: glowPlane,
        textPlane: textPlane,
        maskPlane: maskPlane,
        coverImage: null,
        cardSize: { width: GALLERY_CARD_BASE_WIDTH, height: GALLERY_CARD_BASE_HEIGHT },
        isCollected: isCollected,
        hovered: false
    };

    // Load cover image
    if (project.image) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            project.image,
            (texture) => {
                const imageMaterial = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 1,
                    side: THREE.DoubleSide
                });
                let imagePlane = group.userData.coverImage;
                if (!imagePlane) {
                    imagePlane = new THREE.Mesh(
                        new THREE.PlaneGeometry(GALLERY_CARD_BASE_WIDTH * 0.96, GALLERY_CARD_BASE_HEIGHT * 0.96),
                        imageMaterial
                    );
                    imagePlane.position.z = 0.02;
                    group.add(imagePlane);
                    group.userData.coverImage = imagePlane;
                } else {
                    imagePlane.material = imageMaterial;
                }

                if (group.userData.textPlane) {
                    group.userData.textPlane.visible = false;
                }

                const aspect = texture.image.width / texture.image.height;
                let targetWidth = GALLERY_CARD_MAX_WIDTH;
                let targetHeight = targetWidth / aspect;
                if (targetHeight > GALLERY_CARD_MAX_HEIGHT) {
                    targetHeight = GALLERY_CARD_MAX_HEIGHT;
                    targetWidth = targetHeight * aspect;
                }

                applyCardSize(group, targetWidth, targetHeight);
            },
            undefined,
            (error) => {
                console.warn('Failed to load cover image:', project.image);
            }
        );
    }

    group.position.copy(position);

    return group;
}

function create3DGallery() {
    if (galleryGroup) {
        scene.remove(galleryGroup);
        galleryGroup = null;
    }

    galleryGroup = new THREE.Group();
    galleryItems = [];
    galleryTransition = null;

    const projects = PROJECTS_DATA.slice();
    // Shuffle for a randomized gallery layout
    for (let i = projects.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [projects[i], projects[j]] = [projects[j], projects[i]];
    }

    const rowCounts = [3, 4, 3];
    const totalProjects = projects.length;
    const rows = rowCounts.length;
    const startY = ((rows - 1) * GALLERY_SPACING_Y) / 2;
    let index = 0;

    rowCounts.forEach((rowCols, row) => {
        if (index >= totalProjects) return;
        const rowStartX = -((rowCols - 1) * GALLERY_SPACING_X) / 2;

        for (let col = 0; col < rowCols && index < totalProjects; col += 1) {
            const project = projects[index];
            index += 1;

            const centerCol = (rowCols - 1) / 2;
            const stagger = (col - centerCol) * (GALLERY_SPACING_X * 0.08);
            const jitterX = (Math.random() - 0.5) * 0.4;
            const jitterY = (Math.random() - 0.5) * 0.3;
            const x = rowStartX + col * GALLERY_SPACING_X + stagger + jitterX;
            const y = startY - row * GALLERY_SPACING_Y + jitterY + Math.sin(col * 0.6 + row * 0.4) * 0.3;
            const colOffset = rowCols > 1 ? (col - (rowCols - 1) / 2) / ((rowCols - 1) / 2) : 0;
            const z = -Math.abs(colOffset) * 2.1 + (Math.random() - 0.5) * 0.6 + Math.sin(row * 0.7) * 0.3;
            const position = new THREE.Vector3(x, y, z);

            const item = createGalleryCard(project, position);
            galleryGroup.add(item);
            galleryItems.push(item);
        }
    });

    // Decorative floating particles
    const particleCount = 120;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 6 + Math.random() * 12;
        positions[i * 3] = Math.sin(angle) * radius;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
        positions[i * 3 + 2] = Math.cos(angle) * radius - 8;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
        color: 0x408F98,
        size: 0.04,
        transparent: true,
        opacity: 0.3
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    galleryGroup.add(particles);
    galleryGroup.userData.particles = particles;

    scene.add(galleryGroup);
    galleryGroup.visible = false;

    console.log('3D Gallery created with', galleryItems.length, 'items');
}

function update3DGallery(time, deltaTime) {
    if (!galleryGroup || state.view !== 'gallery') return;
    camera.lookAt(0, 0, 0);

    galleryGroup.rotation.y = Math.sin(time * 0.08) * 0.04;
    galleryGroup.rotation.x = Math.sin(time * 0.06) * 0.02;

    // Animate particles
    if (galleryGroup.userData.particles) {
        galleryGroup.userData.particles.rotation.y = time * 0.05;
    }

    // Floating drift per card + face the camera
    galleryItems.forEach(item => {
        if (item.userData.transitioning) {
            item.lookAt(camera.position);
            return;
        }

        const isCollected = !!state.collectedProjects[item.userData.project.id];
        if (item.userData.isCollected !== isCollected) {
            item.userData.isCollected = isCollected;
            item.userData.card.material.color.setHex(isCollected ? 0x0c2a30 : 0x0a1a1e);
            item.userData.border.material.color.setHex(isCollected ? 0x8fffe6 : 0x408F98);
            item.userData.border.material.opacity = isCollected ? 1 : 0.7;
            if (item.userData.maskPlane) item.userData.maskPlane.visible = !isCollected;
            if (item.userData.cardSize) {
                setGlowPlane(item, item.userData.cardSize.width, item.userData.cardSize.height, isCollected);
            }
        }

        const base = item.userData.basePosition;
        const seed = item.userData.floatSeed;
        item.position.x = base.x + Math.sin(time * 0.6 + seed) * 0.12;
        item.position.y = base.y + Math.cos(time * 0.7 + seed) * 0.16;
        item.position.z = base.z + Math.sin(time * 0.5 + seed) * 0.08;
        item.lookAt(camera.position);

        if (item.userData.glowPlane && isCollected) {
            const pulse = 0.6 + Math.sin(time * 2 + seed) * 0.4;
            item.userData.glowPlane.material.opacity = Math.min(1, Math.max(0, pulse));
        }
    });

    // Hover detection with raycaster
    state.raycaster.setFromCamera(state.mouse, camera);
    const intersects = state.raycaster.intersectObjects(galleryItems, true);

    // Reset all hovers
    galleryItems.forEach(item => {
        if (item.userData.hovered) {
            item.userData.hovered = false;
            gsap.to(item.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
        }
    });

    // Set new hover
    if (intersects.length > 0) {
        let hitItem = intersects[0].object;
        // Find the group parent
        while (hitItem.parent && !hitItem.userData.project) {
            hitItem = hitItem.parent;
        }
        if (hitItem.userData.project) {
            hitItem.userData.hovered = true;
            gsap.to(hitItem.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.3 });
            document.body.style.cursor = 'pointer';
        }
    } else {
        document.body.style.cursor = 'none';
    }
}

function onGalleryClick() {
    if (state.view !== 'gallery') return;
    if (galleryTransition && galleryTransition.active) return;

    state.raycaster.setFromCamera(state.mouse, camera);
    const intersects = state.raycaster.intersectObjects(galleryItems, true);

    if (intersects.length > 0) {
        let hitItem = intersects[0].object;
        while (hitItem.parent && !hitItem.userData.project) {
            hitItem = hitItem.parent;
        }
        if (hitItem.userData.project) {
            animateGalleryItemToDetail(hitItem);
        }
    }
}

function animateGalleryItemToDetail(item) {
    if (!item || (galleryTransition && galleryTransition.active)) return;

    const size = item.userData.cardSize || { width: GALLERY_CARD_BASE_WIDTH, height: GALLERY_CARD_BASE_HEIGHT };
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const targetDistance = 4.6;
    const targetPos = camera.position.clone().add(forward.multiplyScalar(targetDistance));
    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * targetDistance;
    const visibleWidth = visibleHeight * camera.aspect;
    const targetScale = Math.max(visibleWidth / size.width, visibleHeight / size.height) * 1.03;

    galleryTransition = {
        active: true,
        item,
        fromPosition: item.position.clone(),
        fromScale: item.scale.clone()
    };

    item.userData.transitioning = true;

    gsap.to(item.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 0.9,
        ease: "power3.inOut"
    });

    gsap.to(item.scale, {
        x: targetScale,
        y: targetScale,
        z: targetScale,
        duration: 0.9,
        ease: "power3.inOut",
        onComplete: () => {
            item.userData.transitioning = false;
            showProjectDetail(item.userData.project);
        }
    });
}

function animateGalleryItemBack() {
    if (!galleryTransition || !galleryTransition.item) return;
    const item = galleryTransition.item;

    item.userData.transitioning = true;

    gsap.to(item.position, {
        x: galleryTransition.fromPosition.x,
        y: galleryTransition.fromPosition.y,
        z: galleryTransition.fromPosition.z,
        duration: 0.9,
        ease: "power3.inOut"
    });

    gsap.to(item.scale, {
        x: galleryTransition.fromScale.x,
        y: galleryTransition.fromScale.y,
        z: galleryTransition.fromScale.z,
        duration: 0.9,
        ease: "power3.inOut",
        onComplete: () => {
            item.userData.transitioning = false;
            galleryTransition.active = false;
        }
    });
}

// --- Gallery Logic (Legacy - kept for compatibility) ---

function renderGallery() {
    // Render collected projects section
    const collectedGrid = ui.containers.collectedGrid;
    const collectedSection = ui.containers.collectedSection;

    if (!collectedGrid || !collectedSection) return;

    collectedGrid.innerHTML = '';

    const collectedIds = Object.keys(state.collectedProjects);

    if (collectedIds.length > 0) {
        collectedSection.classList.add('has-items');

        collectedIds.forEach(id => {
            const data = state.collectedProjects[id];
            const project = data.project;
            // Only show up to 3 keywords (the ones used for unlocking)
            const usedKeywords = (data.usedKeywords || []).slice(0, 3);

            const item = document.createElement('div');
            item.className = 'gallery-item collected-project-item';
            item.dataset.project = id;
            item.innerHTML = `
                <span class="project-name">${project.name}</span>
                <div class="used-keywords">${usedKeywords.join(' · ')}</div>
            `;
            item.addEventListener('click', () => openProjectFromGallery(id));
            collectedGrid.appendChild(item);
        });
    } else {
        collectedSection.classList.remove('has-items');
    }

}

// Use event delegation for Gallery clicks - more reliable than binding to individual items
function setupGalleryClickHandlers() {
    // Event delegation for all-projects-section
    const allProjectsSection = document.getElementById('all-projects-section');
    if (allProjectsSection) {
        allProjectsSection.addEventListener('click', (e) => {
            const item = e.target.closest('.gallery-item[data-project]');
            if (item) {
                e.preventDefault();
                e.stopPropagation();
                const projectId = item.dataset.project;
                console.log('Gallery item clicked (delegation):', projectId);
                openProjectFromGallery(projectId);
            }
        });
    }

    // Event delegation for collected-grid
    const collectedGrid = document.getElementById('collected-grid');
    if (collectedGrid) {
        collectedGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.gallery-item[data-project]');
            if (item) {
                e.preventDefault();
                e.stopPropagation();
                const projectId = item.dataset.project;
                console.log('Collected item clicked (delegation):', projectId);
                openProjectFromGallery(projectId);
            }
        });
    }
}

function openProjectFromGallery(projectId) {
    console.log('Opening project:', projectId);
    const project = PROJECTS_DATA.find(p => p.id === projectId);
    if (project) {
        showProjectDetail(project);
    } else {
        console.warn('Project not found:', projectId);
    }
}

// Setup click handlers once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupGalleryClickHandlers();
});

// --- Animation Loop ---
let lastTime = performance.now() * 0.001;

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.001;
    const deltaTime = time - lastTime;
    lastTime = time;

    // WASD + QE Navigation (Smooth with Inertia)
    // Only active if we are in Field View AND Field Phase is active
    if (state.view === 'field' && state.fieldPhase === 'active') {
        // Normalize deltaTime and cap it to prevent huge jumps
        const dt = Math.min(deltaTime, 0.1);
        const targetFPS = 60;
        const frameScale = dt * targetFPS; // Scale to 60fps baseline

        // Frame-rate independent acceleration and friction
        const accel = 0.008 * frameScale;
        const rotAccel = 0.0015 * frameScale;
        const pitchAccel = 0.001 * frameScale;
        const friction = Math.pow(0.96, frameScale);
        const minDriftSpeed = 0.0008;

        // Acceleration
        if (state.keys.w) state.velocity.z -= accel;
        if (state.keys.s) state.velocity.z += accel;
        if (state.keys.a) state.rotationVelocity += rotAccel;
        if (state.keys.d) state.rotationVelocity -= rotAccel;

        // Pitch control (Q = look down, E = look up) - unlimited rotation
        if (state.keys.q) state.pitchVelocity -= pitchAccel; // Look up (swapped)
        if (state.keys.e) state.pitchVelocity += pitchAccel; // Look down (swapped)

        // Friction
        state.velocity.z *= friction;
        state.rotationVelocity *= friction;
        state.pitchVelocity *= friction;

        // If velocity is very small, apply a gentle forward drift
        if (Math.abs(state.velocity.z) < minDriftSpeed) {
            state.velocity.z = -minDriftSpeed; // Negative = forward
        }

        // Apply movement and yaw rotation
        camera.translateZ(state.velocity.z);
        camera.rotateY(state.rotationVelocity);

        // Apply pitch (vertical rotation) - no limits, infinite rotation
        camera.rotateX(state.pitchVelocity);
    }

    // Update Shader
    bgMaterial.uniforms.uTime.value = time;
    bgMaterial.uniforms.uMouse.value.lerp(state.targetMouse, 0.05);

    // Update Particles (Explosion)
    if (particles && particles.visible) {
        const positions = particles.geometry.attributes.position.array;
        const vels = particles.userData.velocities;
        const now = performance.now();
        const delta = particles.userData.lastTime ? Math.min((now - particles.userData.lastTime) / 1000, 0.05) : 0.016;
        particles.userData.lastTime = now;
        particles.userData.age = (particles.userData.age || 0) + delta;

        for (let i = 0; i < vels.length; i++) {
            positions[i * 3] += vels[i].x * delta;
            positions[i * 3 + 1] += vels[i].y * delta;
            positions[i * 3 + 2] += vels[i].z * delta;

            // Drag
            const drag = Math.pow(0.3, delta);
            vels[i].x *= drag;
            vels[i].y *= drag;
            vels[i].z *= drag;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        const lifespan = particles.userData.lifespan || 2.8;
        const fade = Math.min(particles.userData.age / lifespan, 1);
        particles.material.opacity = 1 - fade;
        if (particles.material.opacity <= 0.02) {
            scene.remove(particles);
            particles = null;
        }
    }

    // Update Keywords (Field Phase)
    // Only update if visible
    if (keywordGroup && keywordGroup.visible) {
        if (finaleState.active) {
            updateFinaleSpin(deltaTime);
        } else {
            // Get camera's forward direction for proper Z wrapping
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);

            // Pre-calculate camera axes (do this once, not per mesh)
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

            keywordGroup.children.forEach(mesh => {
                // BILLBOARD EFFECT: Make meshes face the camera (even selected ones)
                mesh.quaternion.copy(camera.quaternion);

                // Skip selected keywords for movement/wrapping (they're fixed at bottom)
                if (mesh.userData.selected || mesh.userData.fixed) return;

                // Gentle float
                mesh.position.y += Math.sin(time + mesh.position.x) * 0.002;

                // INFINITE LOOP: Wrap keywords around in all directions
                // Calculate position relative to camera in WORLD space
                const toMesh = mesh.position.clone().sub(camera.position);
                const distance = toMesh.length();

                // DISTANCE-BASED OPACITY: Fade out far keywords
                let targetOpacity = 0.6;
                const fadeNear = WORLD_SIZE * 0.5;
                const fadeMid = WORLD_SIZE * 0.9;
                const fadeFar = WORLD_SIZE * 1.2;

                if (distance > fadeNear && distance <= fadeMid) {
                    const t = (distance - fadeNear) / (fadeMid - fadeNear);
                    targetOpacity = 0.6 - t * 0.3;
                } else if (distance > fadeMid && distance <= WORLD_SIZE) {
                    const t = (distance - fadeMid) / (WORLD_SIZE - fadeMid);
                    targetOpacity = 0.3 - t * 0.15;
                } else if (distance > WORLD_SIZE) {
                    const t = Math.min(1, (distance - WORLD_SIZE) / (fadeFar - WORLD_SIZE));
                    targetOpacity = 0.15 * (1 - t);
                }

                // Smoothly interpolate opacity
                mesh.material.opacity += (targetOpacity - mesh.material.opacity) * 0.1;

                // Get distances along each camera axis
                const distRight = toMesh.dot(camRight);
                const distUp = toMesh.dot(camUp);
                const distForward = toMesh.dot(camForward);

                // Wrap along camera's RIGHT axis (left-right)
                if (distRight > WORLD_SIZE) {
                    mesh.position.sub(camRight.clone().multiplyScalar(WORLD_SIZE * 2));
                } else if (distRight < -WORLD_SIZE) {
                    mesh.position.add(camRight.clone().multiplyScalar(WORLD_SIZE * 2));
                }

                // Wrap along camera's UP axis (up-down)
                if (distUp > WORLD_SIZE) {
                    mesh.position.sub(camUp.clone().multiplyScalar(WORLD_SIZE * 2));
                } else if (distUp < -WORLD_SIZE) {
                    mesh.position.add(camUp.clone().multiplyScalar(WORLD_SIZE * 2));
                }

                // Wrap along camera's FORWARD axis (depth)
                if (distForward > WORLD_SIZE) {
                    mesh.position.sub(camForward.clone().multiplyScalar(WORLD_SIZE * 2));
                } else if (distForward < -WORLD_SIZE) {
                    mesh.position.add(camForward.clone().multiplyScalar(WORLD_SIZE * 2));
                }
            });
        }
    }

    // Update hint lines (lines to related keywords in 3D space)
    if (hintLines.length > 0) {
        hintLines.forEach(line => {
            if (line.userData.startMesh && line.userData.endMesh) {
                const positions = line.geometry.attributes.position.array;
                positions[0] = line.userData.startMesh.position.x;
                positions[1] = line.userData.startMesh.position.y;
                positions[2] = line.userData.startMesh.position.z;
                positions[3] = line.userData.endMesh.position.x;
                positions[4] = line.userData.endMesh.position.y;
                positions[5] = line.userData.endMesh.position.z;
                line.geometry.attributes.position.needsUpdate = true;
            }
        });
    }

    // Update 3D Gallery
    update3DGallery(time, deltaTime);

    composer.render();
}

// --- Listeners ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bgMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    updateBackgroundSize();
});

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

// Keyboard Controls
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft') state.keys.arrowleft = true;
    else if (key === 'arrowright') state.keys.arrowright = true;
    else if (state.keys.hasOwnProperty(key)) state.keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft') state.keys.arrowleft = false;
    else if (key === 'arrowright') state.keys.arrowright = false;
    else if (state.keys.hasOwnProperty(key)) state.keys[key] = false;
});

// Initialize visibility state on load
updateVisibility();

// Clean up any leftover overlays from previous sessions
const leftoverBlur = document.getElementById('unlock-blur-overlay');
if (leftoverBlur) leftoverBlur.remove();

const leftoverNameReveal = document.getElementById('project-name-reveal');
if (leftoverNameReveal) leftoverNameReveal.remove();

// Load projects and initialize app
loadProjectsData().then(() => {
    // Start animation loop after projects are loaded
    animate();

    // Debug: auto-run finale sequence for tuning
    if (DEBUG_FORCE_FINALE) {
        setTimeout(() => startFinaleSequence('debug'), 1200);
    }
}).catch(error => {
    console.error('Failed to load projects:', error);
    // Start anyway with empty projects
    animate();
});
