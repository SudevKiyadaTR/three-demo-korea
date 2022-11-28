import * as THREE from 'three';
import studio from '@theatre/studio';
import {getProject, types} from '@theatre/core';
import projectState from './state.json';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import BazierEasing from 'bezier-easing';

const easingCurvePre = BazierEasing(0.70, 0.00, 0.90, 1.00);
const easingCurvePost = BazierEasing(0.20, 0.00, 1.00, 1.00);
const bgColor = 0x000000;
const sunColor = 0xffee00;
const screenSpacePosition = new THREE.Vector3();
const clipPosition = new THREE.Vector3();
const postprocessing = { enabled: true };
let scene, camera, renderer, labelRenderer;
let land, earth, sun, composer, controls, missile;
let lineCurve, lineGeometry, parent, splineCamera, cameraHelper, cameraEye, birdViewCamera;
let flagDefaultCamera = true, flagBirdEyeView = false, flagVerticalCamera = false;
let earthGlow;
let points = [];
let helper;
let incrementer = 1;
let lookat = new THREE.Vector3();
let currentPosition = 0;
let materialDepth = new THREE.MeshDepthMaterial();
let q = new THREE.Quaternion();
let tubeGeometry, tubeMesh;
let matcapMat;
let renderPass, effectPass, godraysEffect;
let trailLine;
let knowledgeFont;
let heightTickr;
const earthGroup = new THREE.Group();
let playFlag = true;
let resourcesLoaded = 0;
const looptime = 30;
let apogeeFlag = false;

const manager = new THREE.LoadingManager();

// Instantiate a loader
const loader = new GLTFLoader(manager);

let globalUniforms = {
    time: { value: 0 }
};

let trajectoryPath;

const textGroup = new THREE.Group();

let animatingCamera;

let iss;
const up = new THREE.Vector3(0, 1, 0);
const axis = new THREE.Vector3();

let dummyCamera;

const direction = new THREE.Vector3();
const binormal = new THREE.Vector3();
const normal = new THREE.Vector3();
const position = new THREE.Vector3();
const lookAt = new THREE.Vector3();

let missileBinormal = new THREE.Vector3();
let missileNormal = new THREE.Vector3();
let missilePosition = new THREE.Vector3();
let missileLookAt = new THREE.Vector3();
let missileDirection = new THREE.Vector3();

const tubeMaterial = new THREE.MeshLambertMaterial({ color: 0xff00ff });
const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.3, wireframe: true, transparent: true });

let clock = new THREE.Clock();
clock.stop();
let waveClock = new THREE.Clock();
waveClock.start();
let stageOneClock = new THREE.Clock();
let stageTwoClock = new THREE.Clock();

let d = 0;
const skyColor = new THREE.Color(0x000000);
const skyBlue = new THREE.Color(0x05a3fe);
const skyBlack = new THREE.Color(0x000000);

// Use a smaller size for some of the god-ray render targets for better performance.
const godrayRenderTargetResolutionMultiplier = 1.0 / 4.0;

let project, sheet;

// main function --------------------------------------------------------

class App {

    init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        let w = window.innerWidth, h = window.innerHeight;

        camera = new THREE.PerspectiveCamera( 35, w / h, 1, 2000 );

        animatingCamera = new THREE.PerspectiveCamera( 35, w / h, 1, 2000 );

        // setupPane();
        if (import.meta.env.DEV) {
            // studio.extend(extension);
            studio.initialize();
            studio.ui.hide();
        }
        // project = getProject('THREE.js x Theatre.js');
        project = getProject('THREE.js x Theatre.js', {state: projectState});
        sheet = project.sheet('animated scene');

        animatingCamera.position.set(0, 0, 0);
        animatingCamera.rotation.set(0, 2, 1.3);

        RectAreaLightUniformsLib.init();
        const width = 800;
        const height = 250;
        const intensity = 30;
        const rectLight = new THREE.RectAreaLight( 0x999999, intensity,  width, height );
        rectLight.position.set( 0, 1400, 0 );
        rectLight.lookAt( 0, 0, 0 );
        scene.add( rectLight );

        const material = new THREE.LineBasicMaterial({
            color: 0x0000ff
        });

        renderer = new THREE.WebGLRenderer({
            powerPreference: "high-performance",
            antialias: true,
            stencil: false,
            depth: false
        });

        // Pyongyang ICBM facility 39.18098718905343, 125.66405697335942
        // somewhere near Hokkaido 41.39274918458668, 138.76136691354355
        // midpoint between them 40.2868681868, 132.212711943

        const p1 = calcPosFromLatLonRad(39.18098718905343, 125.66405697335942, 637.1);
        const p2 = calcPosFromLatLonRad(41.39274918458668, 138.76136691354355, 635.1);
        const cp = calcPosFromLatLonRad((39.18098718905343 + 41.39274918458668) / 2, (125.66405697335942 + 138.76136691354355) / 2, 637.1 + 624.8);
        const point1 = [p1.x, p1.y, p1.z]; // Point 1 coordinates
        const point2 = [p2.x, p2.y, p2.z]; // Point 2 coordinates
        const controlPoint = [cp.x, cp.y, cp.z]; // Control point coordinates

        // Create a 3D quadratic Bezier curve
        lineCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(point1[0], point1[1], point1[2]),
            new THREE.Vector3(controlPoint[0], controlPoint[1], controlPoint[2]),
            new THREE.Vector3(point2[0], point2[1], point2[2])
        ], false, 'chordal', 0.0);

        const divisions = 1000; // Number of segments of the curve
        points = lineCurve.getPoints(divisions); // Return the number of segments + 1 point, such as points The length is 31

        // Create Geometry
        lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        // geometry.vertices = points; // Assign the point list obtained in the previous step to the vertices attribute of geometry

        tubeGeometry = new THREE.TubeGeometry(lineCurve, 1000, 0.2, 3, false);

        tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
        const wireframe = new THREE.Mesh(tubeGeometry, wireframeMaterial);
        tubeMesh.add(wireframe);

        const texLoader = new THREE.TextureLoader();

        // load a resource
        texLoader.load(
            // resource URL
            import.meta.env.BASE_URL + 'assets/yellow_matcap.png',

            // onLoad callback
            function (texture) {
                // in this example we create the material when the texture is loaded
                matcapMat = new THREE.MeshMatcapMaterial({
                    matcap: texture,
                });

                loadModels();

                resourceLoaded();

                // console.log("matcap loaded");
            },

            // onProgress callback currently not supported
            undefined,

            // onError callback
            function (err) {
                console.error('An error happened.');
            }
        );

        let earthTex;

        const ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath(import.meta.env.BASE_URL + 'js/');
        ktx2Loader.detectSupport(renderer);
        ktx2Loader.load( import.meta.env.BASE_URL + 'assets/world_minimal.ktx2', function ( texture ) {

            // console.log("earth texs loaded", texture);
            let earthGeo = new THREE.SphereGeometry(637.1, 64, 32);

            const earthMap = texture;
            earthMap.wrapT = THREE.RepeatWrapping;
            earthMap.repeat.y = - 1;
            earthMap.encoding = THREE.sRGBEncoding;
            let earthMat = new THREE.MeshStandardMaterial({
                color: 0x666666,
                map: earthMap, 
                roughness: 0.8,
                metalness: 0.6
            });

            earthMat.dithering = true;
            earth = new THREE.Mesh(earthGeo, earthMat);
            earth.position.set(0, 0, 0);

            earthGroup.rotation.set((90 - 40.2868681868) * Math.PI / 180, (90 - 132.212711943) * Math.PI / 180, 0);
            earthGroup.add(earth);
            scene.add(earthGroup);

            initMarkers();

            resourceLoaded();
        
        }, function () {
        
            console.log( 'onProgress' );
        
        }, function ( e ) {
        
            console.error( e );
        
        } );

        // load text object
        const fntLoader = new FontLoader();

        fntLoader.load( import.meta.env.BASE_URL + 'assets/Knowledge Medium_Regular.json', function ( font ) {
            knowledgeFont = font;
            // generateText(font, "International\nSpace Station", 12, calcPosFromLatLonRad(39.8, 125.0, 637.1 + 42 ), earthGroup);
            generateText(font, "Pyongyang", 12, calcPosFromLatLonRad(39.036170458253565, 124.75861353308592, 640), earthGroup);
            generateText(font, "North Korea", 20, calcPosFromLatLonRad(39.81689349316444, 126.22657884591786, 640), earthGroup);
            generateText(font, "Hokkaido", 12, calcPosFromLatLonRad(42.78343327772553, 141.17912575432618, 640), earthGroup);
            generateText(font, "Japan", 20, calcPosFromLatLonRad(35.772943512663176, 137.8048990566746, 640), earthGroup);
            generateText(font, "height", 12, points[0], earthGroup);
        } );

        // renderer.toneMappingExposure = Math.pow(0.7, 1.0);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.gammaFactor = 2.2;
        renderer.gammaOutput = true;
        renderer.physicallyCorrectLights = true;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.autoClear = false;
        renderer.setClearColor(0xffffff);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        // CSS renderer
        labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize( window.innerWidth, window.innerHeight );
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        document.body.appendChild( labelRenderer.domElement );

        controls = new OrbitControls( animatingCamera, renderer.domElement );
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.maxDistance = 2000;
        controls.autoRotate = false;
        controls.zoomSpeed = 5;
        controls.update();

        const renderScene = new RenderPass(scene, animatingCamera);

        const effectFXAA = new ShaderPass( FXAAShader );
        effectFXAA.uniforms.resolution.value.set( 1/ window.innerWidth, 1 / window.innerHeight);

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.80;
        bloomPass.strength = 0.5;
        bloomPass.radius = 1.0;
        bloomPass.renderToScreen = true;

        composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(effectFXAA);
        composer.addPass(bloomPass);
    }

}

function loadModels() {
    // Load Hwasong
    loader.load(
        // resource URL
        import.meta.env.BASE_URL + 'models/untitled.glb',
        // called when the resource is loaded
        function (gltf) {

            missile = gltf.scene;

            missile.traverse((o) => {
                if (o.isMesh) o.material = matcapMat;
            });

            missile.position.set(0, 0, 0);
            missile.scale.set(5.0, 5.0, 5.0);
            missile.renderOrder = 3;
            missile.lookAt(new THREE.Vector3(0, 100, 0));
            missile.visible = false;
            earthGroup.add(missile);

        },
        // called while loading is progressing
        function (xhr) {

            // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

        },
        // called when loading has errors
        function (error) {

            console.log('An error happened');

        }
    );

    manager.onStart = function (url, itemsLoaded, itemsTotal) {
        // console.log('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    manager.onLoad = function () {
        scene.add(textGroup);
        theatre();

        project.ready.then(() => {
            console.log("project is ready");
            // clock.start();
            resourceLoaded();
        });            
    };


    manager.onProgress = function (url, itemsLoaded, itemsTotal) {
        // console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    manager.onError = function (url) {
        console.log('There was an error loading ' + url);
    };
}

function calcPosFromLatLonRad(lat, lon, rad) {
    const phi   = (90 -  lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(rad * Math.sin(phi) * Math.cos(theta));
    const z = (rad * Math.sin(phi) * Math.sin(theta));
    const y = (rad * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
}

function theatre() {

    const cameraObj = sheet.object('CameraObj', {
        // Note that the rotation is in radians
        // (full rotation: 2 * Math.PI)
        fov: types.number(animatingCamera.fov, { range: [0, 100] }),
        position: types.compound({
            x: types.number(animatingCamera.position.x, { range: [-1000, 1000] }),
            y: types.number(animatingCamera.position.y, { range: [-800, 1200] }),
            z: types.number(animatingCamera.position.z, { range: [-100, 2000] })
        }),
        rotation: types.compound({
            x: types.number(animatingCamera.rotation.x, { range: [-2, 2] }),
            y: types.number(animatingCamera.rotation.y, { range: [-2, 2] }),
            z: types.number(animatingCamera.rotation.z, { range: [-2, 2] })
        }),
    });

    cameraObj.onValuesChange((values) => {
        const {x, y, z} = values.position;
        const rx = values.rotation.x;
        const ry = values.rotation.y;
        const rz = values.rotation.z;
        
        animatingCamera.fov = values.fov;
        animatingCamera.position.set(x, y, z);
        if(animatingCamera)
            animatingCamera.rotation.set(rx * Math.PI, ry * Math.PI, rz * Math.PI);
        animatingCamera.updateProjectionMatrix();
    });

    const earthObj = sheet.object('earthGroup', {
        // Note that the rotation is in radians
        rotation: types.compound({
            x: types.number(earthGroup.rotation.x, { range: [-360, 360] }),
            y: types.number(earthGroup.rotation.y, { range: [-360, 360] }),
            z: types.number(earthGroup.rotation.z, { range: [-5, 5] }),
            o: types.number(earthGroup.rotation.z, { range: [-5, 5] })
        }),
    });

    earthObj.onValuesChange((values) => {
        const {x, y, z, o} = values.rotation;

        // - 40.18719, 126.87477
        const verticalOffset = 0.1;
        const phi   = (x) * ( Math.PI / 180 ) - o;
        const theta = (y) * ( Math.PI / 180 );
        const zT = z * Math.PI / 180;

        earthGroup.rotation.set((90 - 40.2868681868) * Math.PI / 180, (90 - 132.212711943) * Math.PI / 180, 0);

        // x-axis rotation
        earthGroup.rotateOnWorldAxis(new THREE.Vector3( 1.0,0,0 ), phi);

        // y-axis rotation
        earthGroup.rotateOnWorldAxis(new THREE.Vector3( 0,1.0,0 ), theta);

        // z-axis rotation
        earthGroup.rotateOnWorldAxis(new THREE.Vector3( 0,0,1.0 ), z);
    });
}

function resourceLoaded() {
    resourcesLoaded += 1;

    if(resourcesLoaded === 3) {
            console.log('now playing');
            sheet.sequence.play({iterationCount: 1, range: [0, 9] });
            animate();
    }
}

function initMarkers() {
    const rad = 637.1;
    const markerPoints = [calcPosFromLatLonRad(39.18098718905343, 125.66405697335942, 637.1), calcPosFromLatLonRad(41.39274918458668, 138.76136691354355, 637.1)];

    // <Markers>
    const markerCount = markerPoints.length;
    let markerInfo = []; // information on markers
    let gMarker = new THREE.PlaneGeometry(8, 8);
    let mMarker = new THREE.MeshBasicMaterial({
    color: 0x111111,
    onBeforeCompile: (shader) => {
        shader.uniforms.time = globalUniforms.time;
        shader.vertexShader = `
            attribute float phase;
        varying float vPhase;
        ${shader.vertexShader}
        `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
            vPhase = phase; // de-synch of ripples
        `
        );
        //console.log(shader.vertexShader);
        shader.fragmentShader = `
            uniform float time;
        varying float vPhase;
            ${shader.fragmentShader}
        `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
        vec2 lUv = (vUv - 0.5) * 2.;
        float val = 0.;
        float lenUv = length(lUv);
        val = max(val, 1. - step(0.25, lenUv)); // central circle
        // val = max(val, step(0.2, lenUv) - step(0.5, lenUv)); // outer circle
        
        float tShift = fract(time * 1.0 + vPhase);
        val = max(val, step(0.0 + (tShift * 0.6), lenUv) - step(0.1 + (tShift * 0.5), lenUv)); // ripple
        
        if (val < 0.5) discard;
        
        vec4 diffuseColor = vec4( diffuse, opacity );`
        );
        //console.log(shader.fragmentShader)
    }
    });
    mMarker.defines = { USE_UV: " " }; // needed to be set to be able to work with UVs
    let markers = new THREE.InstancedMesh(gMarker, mMarker, markerCount);

    let dummy = new THREE.Object3D();
    let phase = [];
    for (let i = 0; i < markerCount; i++) {
    // dummy.position.randomDirection().setLength(rad + 5);
    // const posDummy = calcPosFromLatLonRad(39.036170458253565, 124.75861353308592, 640);
    dummy.position.set(markerPoints[i].x, markerPoints[i].y, markerPoints[i].z);
    // console.log(i + " dummy pos");
    // console.log(dummy.position);
    dummy.lookAt(dummy.position.clone().setLength(rad + 10));
    dummy.updateMatrix();
    markers.setMatrixAt(i, dummy.matrix);
    phase.push(Math.random());

    markerInfo.push({
        id: i + 1,
        mag: 1,
        crd: dummy.position.clone()
    });
    }
    gMarker.setAttribute(
    "phase",
    new THREE.InstancedBufferAttribute(new Float32Array(phase), 1)
    );

    earthGroup.add(markers);
    // console.log('earthGrp');
    // console.log(earthGroup);
    // </Markers>
}

function onWindowResize() {

    animatingCamera.aspect = window.innerWidth / window.innerHeight;
    animatingCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {

    if (sheet.sequence.position >= 0 && clock.elapsedTime == 0) {
        clock.start();
    }

    if(clock.elapsedTime >= 25 && playFlag) {
        sheet.sequence.play({iterationCount: 1, range: [9, 16]});
        playFlag = false;
    }

    if(((clock.elapsedTime + 0.01) / looptime) > 1) {
        missile.visible = false;
        clock.stop();
    }
    
    render();
    animateCSSText();
    requestAnimationFrame(animate);
}

function animateCSSText() {
    const time = sheet.sequence.position;

    const pyongyang_label = document.getElementById('label_Pyongyang');
    const hokkaido_label = document.getElementById('label_Hokkaido');

    pyongyang_label.style.opacity = Math.sin(Math.pow(time / 8, 1) * (Math.PI + Math.PI / 4)) / 2 + 0.5;
    hokkaido_label.style.opacity = Math.sin(Math.pow(time / 8, 1) * (Math.PI + Math.PI / 4)) / 2 + 0.5;
}

function reset() {
    clock.stop();
    clock.start();
}

function generateText(font, message, fontSize, position, parent, name=message) {

    const textContainer = document.createElement( 'div' );
    textContainer.style.filter = 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.5))';
    const labelContainer = document.createElement( 'div' );
    textContainer.appendChild(labelContainer);
    labelContainer.style.filter = 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.5))';
    labelContainer.className = 'label';
    labelContainer.id = "label_" + message;
    labelContainer.textContent = (message === 'height') ? '' : message;
    labelContainer.style.marginTop = '-1em';
    labelContainer.style.fontSize = fontSize + 'px';
    const label = new CSS2DObject( textContainer );
    label.name = 'text_' + name;

    if(label.name == 'text_height')
        labelContainer.style.marginLeft = '6em';

    if(label.name == 'text_Apogee')
        labelContainer.style.marginTop = '-2em';
    
    label.position.set( position.x, position.y, position.z );
    parent.add( label );
}

window.onkeydown = ((e) => {
    if(e.keyCode == 32)
        reset();
});

function render() {
    // to animate markers
    globalUniforms.time.value = waveClock.getElapsedTime();
    let ti = 0, t = 0;

    const time = clock.getElapsedTime();

    if(time < looptime/2 ) {
        ti = (time) / (looptime / 2);
        t = easingCurvePre((ti)) / 2;
    } else {
        ti = (time - (looptime/2)) / (looptime / 2);
        t = easingCurvePost(ti) / 2 + 0.5;
    }
    

    // render trailing line
    if (clock.elapsedTime > 0) {
        renderTrail(t);
        renderHeightTickr(t);
    }

    tubeGeometry.parameters.path.getPointAt(t, position);
    position.multiplyScalar(1);
    tubeGeometry.parameters.path.getPointAt(t, missilePosition);
    missilePosition.multiplyScalar(1);

    // interpolation

    const segments = tubeGeometry.tangents.length;
    const pickt = t * segments;
    const pick = Math.floor(pickt);
    const pickNext = (pick + 1) % segments;

    missileBinormal.subVectors(tubeGeometry.binormals[pickNext], tubeGeometry.binormals[pick]);
    missileBinormal.multiplyScalar(pickt - pick).add(tubeGeometry.binormals[pick]);

    tubeGeometry.parameters.path.getTangentAt(t, missileDirection);

    missileNormal.copy(missileBinormal).cross(missileDirection);

    missilePosition.add(missileNormal.clone().multiplyScalar(0));

    missile.position.set(points[pick].x, points[pick].y, points[pick].z);

    tubeGeometry.parameters.path.getPointAt( ((pick + 2) / segments) % 1, missileLookAt );
    missileLookAt.multiplyScalar(1);

    if(t > 0) {
        missile.matrix.lookAt(missile.position, missileLookAt, missileNormal);
        missile.quaternion.setFromRotationMatrix(missile.matrix);
        
        if(!missile.visible && t < 0.2)
            missile.visible = true;
    }

    // to reset animation
    // if (ti >= 1.0)
    //     reset();

    composer.render();
    labelRenderer.render( scene, animatingCamera );
}

function renderTrail(progress) {
    earthGroup.remove(trailLine);
    const lnPositions = [];
    const colors = [];

    const lnColor = new THREE.Color();

    // draw few points less to avoid colliding trailing line with the missile
    const pointBounds = THREE.MathUtils.clamp(points.length * progress - 10, 0, points.length);

    for(let i = 0; i < pointBounds; i++) {
        lnPositions.push(points[i].x, points[i].y, points[i].z);
        lnColor.setHSL(0.1, 1.0, 0.5);
        colors.push(lnColor.r, lnColor.g, lnColor.b);
    }

    if(lnPositions.length === 0) {
        lnPositions.push(0, 0, 0);
        colors.push(0, 0, 0);
    }

    const lnGeometry = new LineGeometry();
    lnGeometry.setPositions(lnPositions);
    lnGeometry.setColors(colors);

    const lnMaterial = new LineMaterial({
        color: 0xffffff,
        linewidth: 0.0006,
        vertexColors: true,
        dashed: false,
        alphaToCoverage: false,
    });

    trailLine = new Line2(lnGeometry, lnMaterial);
    trailLine.computeLineDistances();
    trailLine.scale.set(1, 1, 1);
    trailLine.name = 'Trail';
    earthGroup.add(trailLine);
}

function renderHeightTickr(progress) {
    heightTickr = earthGroup.getObjectByName('text_height');
    earthGroup.remove(heightTickr);
    const currPosition = Math.floor(points.length * progress);
    const hPosition = points[currPosition].clone();

    let tickrText = "";
    if (progress < 0.96 && progress > 0) {
        tickrText = parseInt(Math.sin(progress * Math.PI) * 6248).toString() + ' kms';
    }

    generateText(knowledgeFont, tickrText, 12, hPosition, earthGroup, 'height');

    if(Math.sin(progress * Math.PI) * 6248 > 6247 && !apogeeFlag) {
        generateText(knowledgeFont, '6248.5 kms', 12, hPosition, earthGroup, 'Apogee');
        apogeeFlag = true;
    }
}

export default App;