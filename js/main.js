import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { FontLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://unpkg.com/three@0.160.0/examples/jsm/geometries/TextGeometry.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { vertexShader, fragmentShader } from './shaders.js';

// --- Configuration ---
const FONT_FAMILY = '"Azeret Mono", monospace';
const WORLD_SIZE = 25;
const MATCH_THRESHOLD = 3; // Number of keywords needed to unlock a project

// --- Projects Data ---
// Each project has: name, fullSentence (the complete creative intent), keywords (5-8 associated words), description, image
const PROJECTS_DATA = [
    {
        id: 'echo-chamber',
        name: 'ECHO CHAMBER',
        fullSentence: 'In the resonance of digital space, we find echoes of our own identity reflected through the network of human connection.',
        keywords: ['RESONANCE', 'ECHO', 'IDENTITY', 'NETWORK', 'CONNECTION', 'DIGITAL', 'SPACE'],
        description: 'An interactive installation exploring how digital environments shape and reflect our sense of self. Through real-time audio visualization, participants witness their voices transformed into visual echoes that persist and interact with others in the space.',
        image: 'assets/projects/echo-chamber.jpg',
        year: '2024'
    },
    {
        id: 'flux-state',
        name: 'FLUX STATE',
        fullSentence: 'The flow of data creates patterns that reveal the hidden momentum and rhythm beneath the chaos of information.',
        keywords: ['FLOW', 'DATA', 'PATTERN', 'MOMENTUM', 'RHYTHM', 'CHAOS', 'VISUALIZATION'],
        description: 'A generative visualization system that transforms live data streams into organic, flowing forms. The piece explores how we can find beauty and meaning in the constant flux of digital information.',
        image: 'assets/projects/flux-state.jpg',
        year: '2024'
    },
    {
        id: 'void-interface',
        name: 'VOID INTERFACE',
        fullSentence: 'At the boundary between void and form, the interface becomes a membrane where human and machine negotiate meaning.',
        keywords: ['VOID', 'FORM', 'INTERFACE', 'HUMAN', 'SYSTEM', 'INTERACTION', 'DESIGN'],
        description: 'An experimental interface design that challenges traditional notions of user interaction. By embracing negative space and ambiguity, it creates moments of contemplation within digital experiences.',
        image: 'assets/projects/void-interface.jpg',
        year: '2023'
    },
    {
        id: 'particle-memory',
        name: 'PARTICLE MEMORY',
        fullSentence: 'Memory exists as particles suspended in time, each fragment carrying the texture and light of lived experience.',
        keywords: ['PARTICLE', 'MEMORY', 'TIME', 'TEXTURE', 'LIGHT', 'FIELD', 'EXPERIENCE'],
        description: 'A WebGL experience that visualizes personal memories as particle systems. Users can navigate through clouds of particles, each cluster representing a memory that reveals itself through interaction.',
        image: 'assets/projects/particle-memory.jpg',
        year: '2023'
    },
    {
        id: 'signal-noise',
        name: 'SIGNAL / NOISE',
        fullSentence: 'In the frequency of modern existence, we must learn to distinguish signal from noise, finding harmony in dissonance.',
        keywords: ['SIGNAL', 'NOISE', 'FREQUENCY', 'HARMONY', 'DISSONANCE', 'WAVE', 'SENSE'],
        description: 'An audiovisual performance piece that explores the threshold between meaningful communication and noise. Using custom software, performers modulate between clarity and chaos.',
        image: 'assets/projects/signal-noise.jpg',
        year: '2023'
    }
];

// Build keyword list from projects + filler words
const PROJECT_KEYWORDS = [...new Set(PROJECTS_DATA.flatMap(p => p.keywords))];
const FILLER_KEYWORDS = [
    "WEBGL", "THREE.JS", "CREATIVE", "CODING", "FUTURE",
    "ORDER", "ART", "ALGORITHM", "GENERATIVE",
    "VIRTUAL", "REALITY", "SHADOW", "FUNCTION", "PROCESS",
    "ENTROPY", "SYNTHESIS", "KINETIC", "CYBERNETIC",
    "GRAVITY", "HORIZON", "PERSPECTIVE", "DIMENSION", "SCALE",
    "VECTOR", "TENSOR", "MATRIX", "NODE", "EDGE", "GRAPH", "TOPOLOGY", "MANIFOLD",
    "PROTOTYPE", "FEEDBACK", "LOOP", "CYCLE", "ITERATION",
    "CONCEPT", "THEORY", "PRACTICE", "METHOD", "APPROACH",
    "SURFACE", "DEPTH", "LAYER", "CORE", "SHELL",
    "EXPAND", "CONTRACT", "ROTATE", "TRANSLATE", "TRANSFORM",
    "PIXEL", "VOXEL", "MESH", "VERTEX", "POLYGON",
    "RENDER", "COMPUTE", "STREAM", "BUFFER",
    "INPUT", "OUTPUT", "STATE", "EVENT", "TRIGGER",
    "FEEL", "TOUCH", "SIGHT", "SOUND",
    "IMMERSIVE", "NARRATIVE", "STRUCTURE", "MOTION"
];
const KEYWORDS = [...PROJECT_KEYWORDS, ...FILLER_KEYWORDS.filter(k => !PROJECT_KEYWORDS.includes(k))];

// --- State ---
const state = {
    view: 'field', // field, gallery, about, search, projectDetail
    fieldPhase: 'landing', // landing, shattering, active, unlocking, projectReveal
    mouse: new THREE.Vector2(),
    targetMouse: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    collectedKeywords: [], // Array of mesh objects
    collectedWords: [], // Array of word strings (for tracking)
    lines: [],
    keys: { w: false, a: false, s: false, d: false, q: false, e: false },
    velocity: new THREE.Vector3(),
    rotationVelocity: 0,
    pitchVelocity: 0, // For vertical rotation (Q/E)
    // Collection System
    collectedProjects: loadCollectedProjects(), // {projectId: {project, usedKeywords: []}}
    currentUnlockingProject: null, // Project being unlocked
    currentProjectDetail: null // Project being viewed in detail
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
    
    // Clear localStorage
    try {
        localStorage.removeItem('collectedProjects');
    } catch (e) {
        console.warn('Failed to clear localStorage');
    }
    
    // Reset UI
    updateBottomBar();
    renderGallery();
    
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

// --- Font Loader (Removed, using Sprites) ---
// Pre-generate keywords but keep them hidden
createKeywords();

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
    });    const scaleFactor = 0.005;
    const geometry = new THREE.PlaneGeometry(canvas.width * scaleFactor, canvas.height * scaleFactor);
    const mesh = new THREE.Mesh(geometry, material);
    
    return mesh;
}

function createKeywords() {
    KEYWORDS.forEach((word, i) => {
        const mesh = createTextSprite(word);
        
        // Random position - fill the entire world space
        // Use WORLD_SIZE to ensure keywords are distributed across the whole looping area
        mesh.position.x = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
        mesh.position.y = (Math.random() - 0.5) * WORLD_SIZE * 1.2; // Less vertical spread
        mesh.position.z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
        
        mesh.userData = { 
            originalPos: mesh.position.clone(),
            word: word,
            velocity: new THREE.Vector3((Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01),
            hovered: false,
            selected: false,
            baseScaleX: 1,
            baseScaleY: 1
        };
        
        keywordGroup.add(mesh);
    });
}

function createExplosion(position) {
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for(let i=0; i<particleCount; i++) {
        positions[i*3] = position.x + (Math.random() - 0.5) * 0.5;
        positions[i*3+1] = position.y + (Math.random() - 0.5) * 0.2;
        positions[i*3+2] = position.z;
        
        velocities.push({
            x: (Math.random() - 0.5) * 0.2,
            y: (Math.random() - 0.5) * 0.2,
            z: (Math.random() - 0.5) * 0.2
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
    particles.userData = { velocities: velocities };
    scene.add(particles);
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
    // Only allow interactions if we are in the Field View
    if (state.view !== 'field') return;

    // Prevent interaction if clicking on UI elements (Nav, etc.)
    // Check if the click target is within the UI layer but NOT the canvas
    // Actually, the UI layer covers everything. We need to check if the target is a specific UI element.
    // But wait, pointer-events: none is on #ui-layer, so clicks pass through to canvas unless they hit a child with pointer-events: auto.
    // If the user clicks a nav link, the event listener on the link handles it.
    // However, the click event might propagate to the window.
    // Let's check the event target.
    if (event.target.closest('.nav-link') || event.target.closest('.menu-item') || event.target.closest('.search-container')) {
        return;
    }

    if (state.fieldPhase === 'landing') {
        // Shatter Title
        createExplosion(new THREE.Vector3(0, 0, 0));
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
        }, 1000);
        
    } else if (state.fieldPhase === 'active') {
        // Raycast for keywords
        state.raycaster.setFromCamera(state.mouse, camera);
        const intersects = state.raycaster.intersectObjects(keywordGroup.children);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            const word = object.userData.word;
            
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
    
    // For each related project, draw lines to other keywords of that project
    relatedProjects.forEach(project => {
        // Skip already collected projects
        if (state.collectedProjects[project.id]) return;
        
        project.keywords.forEach(keyword => {
            // Skip the selected word itself and already selected words
            if (keyword === selectedWord || state.collectedWords.includes(keyword)) return;
            
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
    
    // Create blur overlay that gradually increases
    const blurOverlay = document.createElement('div');
    blurOverlay.id = 'unlock-blur-overlay';
    blurOverlay.className = 'unlock-blur-overlay';
    document.body.appendChild(blurOverlay);
    
    // Animate blur overlay in
    gsap.fromTo(blurOverlay, 
        { opacity: 0 }, 
        { opacity: 1, duration: 0.8, ease: "power2.out" }
    );
    
    // Fade out non-selected keywords smoothly
    keywordGroup.children.forEach(mesh => {
        if (!mesh.userData.selected) {
            gsap.to(mesh.material, { opacity: 0, duration: 0.8 });
        }
    });
    
    // Hide hint lines
    state.lines.forEach(line => {
        gsap.to(line.material, { opacity: 0, duration: 0.5 });
    });
    
    // Get matched meshes and gather them toward camera
    const matchedMeshes = state.collectedKeywords.filter(m => matchedWords.includes(m.userData.word));
    const gatherPoint = new THREE.Vector3(
        camera.position.x,
        camera.position.y,
        camera.position.z - 8
    );
    
    // Phase 1: Gather keywords to center with staggered timing
    matchedMeshes.forEach((mesh, i) => {
        gsap.to(mesh.position, {
            x: gatherPoint.x + (Math.random() - 0.5) * 2,
            y: gatherPoint.y + (Math.random() - 0.5) * 1.5,
            z: gatherPoint.z,
            duration: 1.2,
            delay: i * 0.1,
            ease: "power3.inOut"
        });
        
        // Pulse the keywords as they move
        gsap.to(mesh.material, {
            opacity: 0.8,
            duration: 0.6,
            yoyo: true,
            repeat: 1
        });
    });
    
    // Phase 2: Show sentence after keywords gather
    setTimeout(() => {
        showCompleteSentence(project, matchedMeshes, blurOverlay);
    }, 1400);
}

function showCompleteSentence(project, matchedMeshes, blurOverlay) {
    // Create sentence overlay (on top of blur)
    const sentenceOverlay = document.createElement('div');
    sentenceOverlay.id = 'sentence-overlay';
    sentenceOverlay.className = 'sentence-overlay no-bg'; // No background, uses blur overlay
    
    // Highlight the keywords in the sentence
    let sentenceHTML = project.fullSentence;
    project.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
        sentenceHTML = sentenceHTML.replace(regex, '<span class="highlight-word">$1</span>');
    });
    
    sentenceOverlay.innerHTML = `<p class="full-sentence">${sentenceHTML}</p>`;
    document.body.appendChild(sentenceOverlay);
    
    // Fade matched 3D keywords out as sentence appears
    matchedMeshes.forEach(mesh => {
        gsap.to(mesh.material, { opacity: 0, duration: 0.8 });
    });
    
    // Animate sentence in with letter stagger effect
    gsap.fromTo(sentenceOverlay, 
        { opacity: 0 }, 
        { opacity: 1, duration: 1.2, ease: "power2.out" }
    );
    
    // Phase 3: Dissolve sentence and reveal project name
    setTimeout(() => {
        dissolveSentenceToName(project, sentenceOverlay, blurOverlay);
    }, 3500);
}

function dissolveSentenceToName(project, sentenceOverlay, blurOverlay) {
    // Create particle container for the dissolve effect
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-container';
    document.body.appendChild(particleContainer);
    
    // Get sentence position for particles
    const sentenceEl = sentenceOverlay.querySelector('.full-sentence');
    const rect = sentenceEl.getBoundingClientRect();
    
    // Create particles from sentence position
    const particleCount = 60;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'dissolve-particle';
        particle.style.left = (rect.left + Math.random() * rect.width) + 'px';
        particle.style.top = (rect.top + Math.random() * rect.height) + 'px';
        particleContainer.appendChild(particle);
        
        // Animate particle to center then scatter
        gsap.to(particle, {
            x: (window.innerWidth / 2 - parseFloat(particle.style.left)) + (Math.random() - 0.5) * 100,
            y: (window.innerHeight / 2 - parseFloat(particle.style.top)),
            opacity: 1,
            scale: 1.5,
            duration: 0.8,
            delay: Math.random() * 0.3,
            ease: "power2.out"
        });
    }
    
    // Fade out sentence
    gsap.to(sentenceOverlay, { 
        opacity: 0, 
        duration: 0.6,
        onComplete: () => sentenceOverlay.remove()
    });
    
    // After particles gather, form the project name
    setTimeout(() => {
        // Scatter particles outward
        const particles = particleContainer.querySelectorAll('.dissolve-particle');
        particles.forEach(particle => {
            gsap.to(particle, {
                x: '+=' + (Math.random() - 0.5) * 300,
                y: '+=' + (Math.random() - 0.5) * 200,
                opacity: 0,
                scale: 0,
                duration: 0.8,
                ease: "power2.in"
            });
        });
        
        // Show project name with particles converging effect
        setTimeout(() => {
            particleContainer.remove();
            showProjectNameWithParticles(project, blurOverlay);
        }, 400);
    }, 800);
}

function showProjectNameWithParticles(project, blurOverlay) {
    // Create project name element
    const nameOverlay = document.createElement('div');
    nameOverlay.id = 'project-name-reveal';
    nameOverlay.className = 'project-name-reveal';
    nameOverlay.innerHTML = `<h1 class="project-title-reveal">${project.name}</h1>`;
    document.body.appendChild(nameOverlay);
    
    // Create converging particles around the title
    const particleContainer = document.createElement('div');
    particleContainer.className = 'title-particle-container';
    document.body.appendChild(particleContainer);
    
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'converge-particle';
        
        // Start from random positions around the screen edges
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = Math.max(window.innerWidth, window.innerHeight) * 0.6;
        particle.style.left = (window.innerWidth / 2 + Math.cos(angle) * radius) + 'px';
        particle.style.top = (window.innerHeight / 2 + Math.sin(angle) * radius) + 'px';
        particle.style.opacity = '0';
        particleContainer.appendChild(particle);
        
        // Animate particles converging to center
        gsap.to(particle, {
            left: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
            top: window.innerHeight / 2 + (Math.random() - 0.5) * 100,
            opacity: 1,
            duration: 0.8,
            delay: i * 0.02,
            ease: "power3.out",
            onComplete: () => {
                // Fade out after reaching center
                gsap.to(particle, {
                    opacity: 0,
                    scale: 0,
                    duration: 0.4,
                    delay: 0.2
                });
            }
        });
    }
    
    // Animate title in - scale up with glow
    gsap.fromTo(nameOverlay, 
        { opacity: 0, scale: 0.3 }, 
        { 
            opacity: 1, 
            scale: 1, 
            duration: 1.2, 
            ease: "back.out(1.4)",
            delay: 0.3
        }
    );
    
    // Clean up particles after animation
    setTimeout(() => {
        particleContainer.remove();
    }, 2000);
    
    // Phase 4: Title stays centered, waits for scroll
    setTimeout(() => {
        setupScrollDrivenTransition(project, nameOverlay, blurOverlay);
    }, 2500);
}

// Scroll-driven title animation (like paprikawang)
function setupScrollDrivenTransition(project, nameOverlay, blurOverlay) {
    // Create a scroll container that will drive the animation
    const scrollDriver = document.createElement('div');
    scrollDriver.id = 'scroll-driver';
    scrollDriver.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        z-index: 52;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
    `;
    
    // Inner content to make it scrollable (much taller than viewport)
    const scrollContent = document.createElement('div');
    scrollContent.style.cssText = `
        height: 250vh;
        width: 100%;
        pointer-events: none;
    `;
    scrollDriver.appendChild(scrollContent);
    
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
    
    document.body.appendChild(scrollDriver);
    
    // Get title element for font-size animation
    const titleReveal = nameOverlay.querySelector('.project-title-reveal');
    
    // Initial values (center of screen)
    const startTop = window.innerHeight / 2;
    const startLeft = window.innerWidth / 2;
    const startFontSize = window.innerWidth * 0.08; // 8vw
    
    // Target values (top-left corner)
    const targetTop = 140;
    const targetLeft = 60;
    const targetFontSize = 48; // 3rem = 48px
    
    // Scroll threshold (when animation completes)
    const scrollThreshold = window.innerHeight * 0.8;
    
    let animationComplete = false;
    let titleInPosition = false;
    
    // Prepare project detail view content (hidden)
    const detailView = document.getElementById('project-detail-view');
    const titleEl = detailView.querySelector('.project-detail-title');
    const yearEl = detailView.querySelector('.project-detail-year');
    const descEl = detailView.querySelector('.project-detail-description');
    const keywordsEl = detailView.querySelector('.project-detail-keywords');
    
    titleEl.textContent = project.name;
    yearEl.textContent = project.year || '';
    descEl.textContent = project.description;
    
    // Show keywords used to unlock
    const usedKeywords = state.collectedWords;
    keywordsEl.innerHTML = usedKeywords.map(k => `<span class="detail-keyword">${k}</span>`).join('');
    
    // Hide detail title initially
    titleEl.style.opacity = '0';
    
    // Scroll handler
    function onScroll() {
        if (animationComplete) return; // Stop processing once complete
        
        const scrollY = scrollDriver.scrollTop;
        const progress = Math.min(scrollY / scrollThreshold, 1);
        
        // Easing function for smooth animation
        const easedProgress = easeInOutCubic(progress);
        
        // Fade out scroll hint as user scrolls
        if (progress > 0 && progress < 0.3) {
            scrollHint.style.opacity = 1 - (progress / 0.3);
        } else if (progress >= 0.3) {
            scrollHint.style.opacity = 0;
        }
        
        // Interpolate position
        const currentTop = startTop + (targetTop - startTop) * easedProgress;
        const currentLeft = startLeft + (targetLeft - startLeft) * easedProgress;
        const currentFontSize = startFontSize + (targetFontSize - startFontSize) * easedProgress;
        
        // Apply transform
        nameOverlay.style.top = currentTop + 'px';
        nameOverlay.style.left = currentLeft + 'px';
        nameOverlay.style.transform = `translate(${-50 * (1 - easedProgress)}%, ${-50 * (1 - easedProgress)}%)`;
        titleReveal.style.fontSize = currentFontSize + 'px';
        
        // When title reaches position, lock scroll and start content animation
        if (progress >= 0.95 && !titleInPosition) {
            titleInPosition = true;
            
            // Lock title in final position
            nameOverlay.style.top = targetTop + 'px';
            nameOverlay.style.left = targetLeft + 'px';
            nameOverlay.style.transform = 'translate(0, 0)';
            titleReveal.style.fontSize = targetFontSize + 'px';
            
            // Prevent further scrolling during content animation
            scrollDriver.style.overflow = 'hidden';
            
            // Start content slide-in animation
            completeScrollTransition(project, nameOverlay, blurOverlay, scrollDriver, scrollHint, detailView, titleEl);
            animationComplete = true;
        }
    }
    
    scrollDriver.addEventListener('scroll', onScroll);
    
    // Prevent scroll jump on wheel event
    scrollDriver.addEventListener('wheel', (e) => {
        if (animationComplete) {
            e.preventDefault();
        }
    }, { passive: false });
}

function easeInOutCubic(t) {
    return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function completeScrollTransition(project, nameOverlay, blurOverlay, scrollDriver, scrollHint, detailView, titleEl) {
    // Remove scroll driver
    scrollDriver.remove();
    scrollHint.remove();
    
    // Keep title visible and in final position
    nameOverlay.style.position = 'fixed';
    nameOverlay.style.top = '140px';
    nameOverlay.style.left = '60px';
    nameOverlay.style.transform = 'translate(0, 0)';
    nameOverlay.style.zIndex = '56'; // Above detail view
    
    // Fade out blur overlay
    gsap.to(blurOverlay, {
        opacity: 0,
        duration: 0.4,
        onComplete: () => blurOverlay.remove()
    });
    
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
    const descEl = detailView.querySelector('.project-detail-description');
    const keywordsEl = detailView.querySelector('.project-detail-keywords');
    
    titleEl.textContent = project.name;
    yearEl.textContent = project.year || '';
    descEl.textContent = project.description;
    
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
    
    // Return to previous view
    if (state.previousView === 'gallery') {
        state.view = 'gallery';
        
        // Get gallery element directly and show it
        const galleryEl = document.getElementById('gallery-view');
        galleryEl.classList.remove('hidden');
        
        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        if (ui.nav.gallery) ui.nav.gallery.classList.add('active');
        
        // Keep canvas dimmed
        document.getElementById('canvas-container').style.opacity = '0.7';
        document.getElementById('canvas-container').style.pointerEvents = 'none';
        
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
}

function clearCollectedKeywords() {
    // Reset all selected keywords
    state.collectedKeywords.forEach(mesh => {
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
        search: document.getElementById('nav-search'),
        menu: document.getElementById('nav-menu')
    },
    views: {
        field: document.getElementById('canvas-container'),
        gallery: document.getElementById('gallery-view'),
        about: document.getElementById('about-view'),
        projectDetail: document.getElementById('project-detail-view')
    },
    overlays: {
        search: document.getElementById('search-overlay'),
        menu: document.getElementById('side-menu'),
        contact: document.getElementById('contact-overlay')
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
        search: document.getElementById('search-input'),
        searchClose: document.getElementById('search-close'),
        contactClose: document.getElementById('contact-close'),
        projectDetailBack: document.getElementById('project-detail-back')
    },
    containers: {
        canvas: document.getElementById('canvas-container'),
        uiLayer: document.getElementById('ui-layer'),
        collectedBar: document.getElementById('collected-keywords-bar'),
        collectedGrid: document.getElementById('collected-grid'),
        collectedSection: document.getElementById('collected-section')
    }
};

function updateVisibility() {
    const landingTitle = document.getElementById('landing-title');
    
    // 1. Handle HTML Title Visibility
    if (state.view === 'field' && state.fieldPhase === 'landing') {
        landingTitle.style.opacity = '1';
        landingTitle.style.pointerEvents = 'auto';
    } else {
        landingTitle.style.opacity = '0';
        landingTitle.style.pointerEvents = 'none';
    }

    // 2. Handle 3D Keywords Visibility
    // Keywords should only be visible if we are in Field View AND Field Phase is active (or unlocking)
    const showKeywords = (state.view === 'field' && (state.fieldPhase === 'active' || state.fieldPhase === 'unlocking'));
    
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
        // Ensure fieldPhase is active so keywords are visible
        // (unless we're in landing phase which shouldn't happen here)
        if (state.fieldPhase !== 'landing' && state.fieldPhase !== 'shattering') {
            state.fieldPhase = 'active';
        }
    } else if (viewName === 'gallery') {
        // Keep canvas visible but slightly dimmed
        ui.containers.canvas.style.opacity = '0.7';
        ui.containers.canvas.style.pointerEvents = 'none';
        ui.views.gallery.classList.remove('hidden');
        // Render gallery with collected projects
        renderGallery();
    } else if (viewName === 'about') {
        ui.containers.canvas.style.opacity = '0.7';
        ui.containers.canvas.style.pointerEvents = 'none';
        ui.views.about.classList.remove('hidden');
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

// Search Listener
ui.nav.search.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.search.classList.remove('hidden');
    ui.containers.canvas.style.filter = 'blur(10px)'; // Blur the background
    ui.containers.uiLayer.style.filter = 'blur(10px)'; // Blur the UI
    ui.inputs.search.focus();
});

ui.inputs.searchClose.addEventListener('click', () => {
    ui.overlays.search.classList.add('hidden');
    ui.containers.canvas.style.filter = 'none'; // Remove blur
    ui.containers.uiLayer.style.filter = 'none';
});

// Close search on Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ui.overlays.search.classList.contains('hidden')) {
        ui.overlays.search.classList.add('hidden');
        ui.containers.canvas.style.filter = 'none';
        ui.containers.uiLayer.style.filter = 'none';
    }
});

// Menu Listener
ui.nav.menu.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.toggle('open');
});

// Menu Items Logic
ui.menuItems.home.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.remove('open');
    
    // Reset to Field Landing
    switchView('field');
    state.fieldPhase = 'landing';
    state.collectedKeywords = []; // Clear collected
    state.collectedWords = []; // Clear collected words
    
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
    ui.overlays.menu.classList.remove('open');
    switchView('about');
});

ui.menuItems.find.addEventListener('click', (e) => {
    e.preventDefault();
    // Placeholder for "Find Yourself"
    console.log("Find Yourself clicked");
});

ui.menuItems.contact.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.remove('open');
    ui.overlays.contact.classList.remove('hidden');
});

ui.menuItems.reset.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to reset all collected projects? This action cannot be undone.')) {
        resetCollectedProjects();
        ui.overlays.menu.classList.remove('open');
        switchView('field');
    }
});

ui.menuItems.close.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.remove('open');
});

ui.inputs.contactClose.addEventListener('click', () => {
    ui.overlays.contact.classList.add('hidden');
});

// Project Detail Back Button
ui.inputs.projectDetailBack.addEventListener('click', () => {
    hideProjectDetail();
});

// Close menu when clicking outside (optional, but good UX)
document.addEventListener('click', (e) => {
    if (!ui.overlays.menu.contains(e.target) && e.target !== ui.nav.menu) {
        ui.overlays.menu.classList.remove('open');
    }
});

// --- Gallery Logic ---

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

function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now() * 0.001;
    
    // WASD + QE Navigation (Smooth with Inertia)
    // Only active if we are in Field View AND Field Phase is active
    if (state.view === 'field' && state.fieldPhase === 'active') {
        const accel = 0.008;
        const rotAccel = 0.0015;
        const pitchAccel = 0.001; // Pitch acceleration (vertical look)
        const friction = 0.96;
        const minDriftSpeed = 0.0008;

        // Acceleration
        if (state.keys.w) state.velocity.z -= accel;
        if (state.keys.s) state.velocity.z += accel;
        if (state.keys.a) state.rotationVelocity += rotAccel;
        if (state.keys.d) state.rotationVelocity -= rotAccel;
        
        // Pitch control (Q = look down, E = look up) - unlimited rotation
        if (state.keys.e) state.pitchVelocity -= pitchAccel; // Look up
        if (state.keys.q) state.pitchVelocity += pitchAccel; // Look down

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
        
        for(let i=0; i<vels.length; i++) {
            positions[i*3] += vels[i].x;
            positions[i*3+1] += vels[i].y;
            positions[i*3+2] += vels[i].z;
            
            // Drag
            vels[i].x *= 0.98;
            vels[i].y *= 0.98;
            vels[i].z *= 0.98;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.material.opacity -= 0.01;
        if (particles.material.opacity <= 0) {
            scene.remove(particles);
            particles = null;
        }
    }
    
    // Update Keywords (Field Phase)
    // Only update if visible
    if (keywordGroup && keywordGroup.visible) {
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
            
            if (distance > 10 && distance <= 20) {
                const t = (distance - 10) / 10;
                targetOpacity = 0.6 - t * 0.35;
            } else if (distance > 20 && distance <= WORLD_SIZE) {
                const t = (distance - 20) / (WORLD_SIZE - 20);
                targetOpacity = 0.25 - t * 0.17;
            } else if (distance > WORLD_SIZE) {
                const t = Math.min(1, (distance - WORLD_SIZE) / 5);
                targetOpacity = 0.08 * (1 - t);
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
    if (state.keys.hasOwnProperty(key)) state.keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (state.keys.hasOwnProperty(key)) state.keys[key] = false;
});

// Initialize visibility state on load
updateVisibility();

// Render initial gallery state
renderGallery();

// Start
animate();
