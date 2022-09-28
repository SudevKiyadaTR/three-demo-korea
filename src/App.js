import * as THREE from 'three';
import * as POSTPROCESSING from 'postprocessing';
import studio from '@theatre/studio';
import {getProject, types, val} from '@theatre/core';
import projectState from './state.json';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

const bgColor = 0x000000;
const sunColor = 0xffee00;
const screenSpacePosition = new THREE.Vector3();
const clipPosition = new THREE.Vector3();
const postprocessing = { enabled: true };
let scene, camera, renderer;
let land, earth, sun, composer, controls, missile;
let lineCurve, lineGeometry, parent, splineCamera, cameraHelper, cameraEye, birdViewCamera;
let flagDefaultCamera = true, flagBirdEyeView = false, flagVerticalCamera = false;
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
let stageOneClock = new THREE.Clock();
let stageTwoClock = new THREE.Clock();

let d = 0;
const skyColor = new THREE.Color(0x000000);
const skyBlue = new THREE.Color(0x05a3fe);
const skyBlack = new THREE.Color(0x000000);

// Use a smaller size for some of the god-ray render targets for better performance.
const godrayRenderTargetResolutionMultiplier = 1.0 / 4.0;

let project, sheet;


const PARAMS = {
    offset: 0.12,
    lookAhead: false,
    earthColor: 0x030303
};

const pane = new Tweakpane.Pane();

function setupPane() {
    pane.addInput(PARAMS, 'offset', {
        min: 0,
        max: 5,
        step: 0.01
    });
    
    pane.addInput(PARAMS, 'lookAhead');
    
    const defaultBtn = pane.addButton({
        title: 'Default Camera'
    });
    
    defaultBtn.on('click', () => {
        flagDefaultCamera = true;
        flagVerticalCamera = false;
        flagBirdEyeView = false;
    });
    
    const verticalBtn = pane.addButton({
        title: 'Vertical Camera'
    });
    
    verticalBtn.on('click', () => {
        flagDefaultCamera = false;
        flagVerticalCamera = true;
        flagBirdEyeView = false;
    });
    
    
    const birdViewBtn = pane.addButton({
        title: 'BirdEyeView'
    });
    
    birdViewBtn.on('click', () => {
        flagDefaultCamera = false;
        flagVerticalCamera = false;
        flagBirdEyeView = true;
    });
    
    const restartBtn = pane.addButton({
        title: 'Restart'
    });
    
    restartBtn.on('click', () => {
        reset();
    });
    
    pane.addInput(PARAMS, 'earthColor', {
        view: 'color',
    }).on("change", (ev) => {
        earth.material.color.setHex(PARAMS.earthColor);
    });
}

// main function --------------------------------------------------------

class App {

    init() {
        // setupPane();
        if (import.meta.env.DEV) {
            // studio.extend(extension);
            studio.initialize();
        }
        project = getProject('THREE.js x Theatre.js', {state: projectState});
        sheet = project.sheet('animated scene');
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        let w = window.innerWidth, h = window.innerHeight;

        camera = new THREE.PerspectiveCamera( 35, w / h, 1, 2000 );

        animatingCamera = new THREE.PerspectiveCamera( 35, w / h, 1, 2000 );

        animatingCamera.position.set(0, 0, 0);
        animatingCamera.rotation.set(0, 2, 1.3);
        // cameraHelper = new THREE.CameraHelper( animatingCamera );
        // scene.add( cameraHelper );

        // const light = new THREE.AmbientLight(0xA0A0A0, 4); // soft white light
        // scene.add(light);

        // let directionalLight = new THREE.DirectionalLight(0x999999, 2);
        // directionalLight.position.set(0, 1, 0);
        // scene.add(directionalLight);

        RectAreaLightUniformsLib.init();
        const width = 1000;
        const height = 500;
        const intensity = 20;
        const rectLight = new THREE.RectAreaLight( 0x999999, intensity,  width, height );
        rectLight.position.set( 0, 1000, 0 );
        rectLight.lookAt( 0, 0, 0 );
        scene.add( rectLight );
        // scene.add( new RectAreaLightHelper( rectLight ) );

        const material = new THREE.LineBasicMaterial({
            color: 0x0000ff
        });

        const point1 = [-50, 0, 0]; // Point 1 coordinates
        const point2 = [50, -5, 0]; // Point 2 coordinates
        const controlPoint = [0, 624.8, 0]; // Control point coordinates

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
        // scene.add( tubeMesh );

        splineCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 151000);
        scene.add(splineCamera);

        birdViewCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 151000);
        scene.add(birdViewCamera);

        // Generate material
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x111111,
            linewidth: 1,
            linecap: 'round', //ignored by WebGLRenderer
            linejoin: 'round' //ignored by WebGLRenderer
        });

        const mesh = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(mesh);

        // var envmap = new RGBELoader().load( "./assets/studio_small_06_4k.hdr" );
        // scene.environment = envmap;

        const manager = new THREE.LoadingManager();

        // Instantiate a loader
        const loader = new GLTFLoader(manager);

        // Load ISS
        loader.load(
            // resource URL
            './models/iss.glb',
            // called when the resource is loaded
            function (gltf) {

                iss = gltf.scene;

                iss.scale.set(1, 1, 1);
                iss.position.set(-40, 42, 0);
                scene.add(iss);

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

        // Load Hwasong
        loader.load(
            // resource URL
            './models/missile2.glb',
            // called when the resource is loaded
            function (gltf) {

                missile = gltf.scene;

                missile.traverse((o) => {
                    if (o.isMesh) o.material = matcapMat;
                });

                missile.position.set(0, 0, 0);
                missile.scale.set(5.0, 5.0, 5.0);
                scene.add(missile);

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
                clock.start();
            sheet.sequence.play({ iterationCount: Infinity });
            animate();
        });
        };


        manager.onProgress = function (url, itemsLoaded, itemsTotal) {
            // console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
        };

        manager.onError = function (url) {
            console.log('There was an error loading ' + url);
        };

        const texLoader = new THREE.TextureLoader();

        // load a resource
        texLoader.load(
            // resource URL
            '/assets/yellow_matcap.png',

            // onLoad callback
            function (texture) {
                // in this example we create the material when the texture is loaded
                matcapMat = new THREE.MeshMatcapMaterial({
                    matcap: texture,
                });

                tubeMesh.material = matcapMat;

                console.log("matcap loaded");
            },

            // onProgress callback currently not supported
            undefined,

            // onError callback
            function (err) {
                console.error('An error happened.');
            }
        );

        let earthTex;

        const texture = Promise.all([texLoader.load( '/assets/2k_earth_daymap.jpeg'), texLoader.load('/assets/2k_earth_specular_map 1.jpg'), texLoader.load('/assets/elev_bump_8k.jpeg')], (resolve, reject) => {
            resolve(texture);
        }).then(result => {
            // result in array of textures
            let earthGeo = new THREE.SphereGeometry(637.1, 32, 24);
            // let earthMat = new THREE.MeshBasicMaterial({color: 0xffccaa});
            let earthMat = new THREE.MeshStandardMaterial({
                color: 0x444444,
                map: result[0],
                roughness: 0.5,
                bumpMap: result[2],
                bumpScale: 3.0,
                metalness: 0.3,
                reflectivity: 0.5,
                clearcoat: 0.0
            });

            earthMat.shading = THREE.SmoothShading;
            earth = new THREE.Mesh(earthGeo, earthMat);
            earth.position.set(0, -637.1, 0);
            earth.rotation.set(-0.4282151898734179, 0.7, 0.19948101265822782);
            scene.add(earth);
        });

        // load text objects
        const fntLoader = new FontLoader();

        fntLoader.load( '/assets/Knowledge Medium_Regular.json', function ( font ) {
            generateText(font, "North Korea", 8, new THREE.Vector3(-50, 10, 0));
            generateText(font, "Pyongyang", 3, new THREE.Vector3(-50, 3, 0));
            generateText(font, "Japan", 8, new THREE.Vector3(40, 10, 50));
            generateText(font, "Hokkaido", 3, new THREE.Vector3(100, 3, 0));
            generateText(font, "International Space Station", 2, new THREE.Vector3(-30, 50, 0));
        } );

        // // load a resource
        // texLoader.load(
        //     // resource URL
        //     '../assets/2k_earth_daymap.jpeg.jpeg',

        //     // onLoad callback
        //     function (texture) {
        //         // in this example we create the material when the texture is loaded
        //         earthTex = texture;
        //         let earthGeo = new THREE.SphereGeometry(637.1, 32, 24);
        //         // let earthMat = new THREE.MeshBasicMaterial({color: 0xffccaa});
        //         let earthMat = new THREE.MeshPhysicalMaterial({
        //             map: earthTex,
        //             roughness: 0.48,
        //             metalness: 0.478,
        //             reflectivity: 0.189,
        //             clearcoat: 0.
        //         });
        //         earthMat.shading = THREE.SmoothShading;
        //         earth = new THREE.Mesh(earthGeo, earthMat);
        //         earth.position.set(0, -637.1, 0);
        //         scene.add(earth);
        //     },

        //     // onProgress callback currently not supported
        //     undefined,

        //     // onError callback
        //     function (err) {
        //         console.error('An error happened.');
        //     }
        // );

        let circleGeo = new THREE.CircleGeometry(220, 50);
        let circleMat = new THREE.MeshBasicMaterial({ color: 0xffccaa });
        let circle = new THREE.Mesh(circleGeo, circleMat);
        circle.position.set(1500, 500, 0);
        circle.scale.setX(1.2);
        circle.lookAt(new THREE.Vector3(0, 0, 0));
        // scene.add(circle);

        renderer = new THREE.WebGLRenderer({
            powerPreference: "high-performance",
            antialias: true,
            stencil: false,
            depth: false
        });
        // renderer.toneMappingExposure = Math.pow(0.7, 1.0);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.physicallyCorrectLights = true;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.autoClear = false;
        renderer.setClearColor(0xffffff);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        //HDRI LOADER
        // var envmaploader = new THREE.PMREMGenerator(renderer);
        // const loadhdri = new RGBELoader().load("../assets/starmap_4k.hdr", function (texture) {
        //     texture.mapping = THREE.EquirectangularReflectionMapping;
        //     scene.background = texture;
        //     scene.environment = texture;
        //     scene.envmap
        // });

        controls = new OrbitControls( animatingCamera, renderer.domElement );
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.maxDistance = 2000;
        controls.autoRotate = false;
        controls.zoomSpeed = 5;
        // controls.object.position.set(0, 100, 700);
        // controls.target = new THREE.Vector3(0, 100, 0);
        controls.update();

        // controls = new FirstPersonControls( camera);
        // controls.lookSpeed = 0.05;
        // controls.movementSpeed = 0;

        godraysEffect = new POSTPROCESSING.GodRaysEffect(splineCamera, circle, {
            resolutionScale: 1,
            density: 0.9,
            decay: 0.95,
            weight: 0.9,
            samples: 300
        });

        renderPass = new POSTPROCESSING.RenderPass(scene, animatingCamera);
        effectPass = new POSTPROCESSING.EffectPass(animatingCamera, godraysEffect);
        effectPass.renderToScreen = true;

        composer = new POSTPROCESSING.EffectComposer(renderer);
        composer.addPass(renderPass);
        composer.addPass(effectPass);
    }

}

function theatre() {
    animatingCamera.lookAt(0.5, 1, 0);
    animatingCamera.position.set(0, 0, 300);

    const cameraObj = sheet.object('CameraObj', {
        // Note that the rotation is in radians
        // (full rotation: 2 * Math.PI)
        fov: types.number(animatingCamera.fov, { range: [0, 100] }),
        position: types.compound({
            x: types.number(animatingCamera.position.x, { range: [-1000, 1000] }),
            y: types.number(animatingCamera.position.y, { range: [-800, 1200] }),
            z: types.number(animatingCamera.position.z, { range: [0, 2000] })
        }),
        rotation: types.compound({
            x: types.number(animatingCamera.rotation.x, { range: [-2, 2] }),
            y: types.number(animatingCamera.rotation.y, { range: [-2, 2] }),
            z: types.number(animatingCamera.rotation.z, { range: [-2, 2] })
        }),
        // lookAt: types.compound({
        //     x: types.number(camera.lookAt.x, { range: [-1000, 1000] }),
        //     y: types.number(camera.lookAt.y, { range: [-2, 1200] }),
        //     z: types.number(camera.lookAt.z, { range: [-1000, 1000] })
        // })
    });

    cameraObj.onValuesChange((values) => {
        const {x, y, z} = values.position;
        const rx = values.rotation.x;
        const ry = values.rotation.y;
        const rz = values.rotation.z;
        // const {lx, ly, lz} = values.lookAt;
        
        animatingCamera.fov = values.fov;
        animatingCamera.position.set(x, y, z);
        if(animatingCamera)
            animatingCamera.rotation.set(rx * Math.PI, ry * Math.PI, rz * Math.PI);
        // animatingCamera.lookAt(missile);
        // controls.target = new THREE.Vector3(0, y, 0);
        animatingCamera.updateProjectionMatrix();
        // console.log(animatingCamera.position, cameraHelper.camera.position);
        // controls.object.target = new THREE.Vector3(x, Math.random() * y, 0);

        // controls.update();
    });

    const earthObj = sheet.object('EarthObj', {
        // Note that the rotation is in radians
        rotation: types.compound({
            x: types.number(earth.rotation.x, { range: [-2, 2] }),
            y: types.number(earth.rotation.y, { range: [-2, 2] }),
            z: types.number(earth.rotation.z, { range: [-2, 2] })
        }),
    });

    earthObj.onValuesChange((values) => {
        const {x, y, z} = values.rotation;

        earth.rotation.set(x * Math.PI, y * Math.PI, z * Math.PI);
    });
}

function addComposer(cam) {
    renderPass = new POSTPROCESSING.RenderPass(scene, cam);
    effectPass = new POSTPROCESSING.EffectPass(cam, godraysEffect);
    effectPass.renderToScreen = true;

    composer = new POSTPROCESSING.EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(effectPass);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {
    // controls.update();
    requestAnimationFrame(animate);
    render();

    // let dist = land.position.distanceTo(splineCamera.position);
    // skyColorTransition(dist);
}

function skyColorTransition(dist) {
    d = THREE.MathUtils.mapLinear(dist, 5, 300, 0, 1);
    scene.background = skyColor.lerpColors(skyBlue, skyBlack, d);

    if (dist > 100)
        earth.visible = true;
    else
        earth.visible = false;
}

function renderCamera(n) {

    if ((currentPosition < (0.1 * points.length)) || (currentPosition > 0.9 * points.length))
        incrementer = 1 * n;
    else
        incrementer = 5 * n;

    let tx = points[currentPosition].x;
    let ty = points[currentPosition].y;
    let tz = points[currentPosition].z;

    camera.position.set(tx, ty, tz);

    if (currentPosition < (points.length - 6))
        camera.lookAt(points[currentPosition + 1].x, points[currentPosition + 1].y, points[currentPosition + 1].z);

    currentPosition = THREE.MathUtils.clamp((currentPosition + incrementer) % points.length, 0, points.length - 1);

    tx = points[currentPosition].x;
    ty = points[currentPosition].y;
    tz = points[currentPosition].z;
}

function ease(x, m = 1) {
    if (x <= 0.51){
        return easeOutCubic(x * m) * 0.5;
    } else {
        return easeInCubic(((x) % 0.5) * 2) * 0.5 + 0.5;
    }
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 5);
}

function easeInCubic(x) {
    return x*x*x*x*x;
}

function reset() {
    // scene.remove(missile);
    // scene.remove(missileBase);
    // scene.remove(missileBaseR);
    // scene.remove(missileBaseL);
    // scene.remove(stageTwo);
    // missileBase = null;
    // missileBaseTrajectory = null;
    // stageTwoTrajectory = null;
    // missile = new THREE.Object3D();
    // missile = missileOrig.clone();
    // scene.add(missile);
    clock.stop();
    clock.start();
    // stageOneClock.stop();
    // stageTwoClock.stop();
}

function generateText(font, message, fontSize, position) {
    const shapes = font.generateShapes( message, fontSize );

    const textGeo = new THREE.ShapeGeometry( shapes );

    textGeo.computeBoundingBox();

    const centerOffset = - 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x );

    const textMat = new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide});

    const textMesh = new THREE.Mesh( textGeo, textMat );

    textMesh.position.set(centerOffset + position.x, position.y, position.z);

    textGroup.add(textMesh);
}

window.onkeydown = ((e) => {
    if(e.keyCode == 32)
        reset();
});

function render() {

    // animate camera along spline

    const time = clock.getElapsedTime();
    const looptime = 20 * 1;
    let ti = (time % looptime) / looptime;
    let t = ease(ti, 1);

    tubeGeometry.parameters.path.getPointAt(t, position);
    position.multiplyScalar(1);
    tubeGeometry.parameters.path.getPointAt(t + 0.01, missilePosition);
    missilePosition.multiplyScalar(1);

    // interpolation

    const segments = tubeGeometry.tangents.length;
    const pickt = t * segments;
    const pick = Math.floor(pickt);
    const pickNext = (pick + 1) % segments;
    const missileNext = (pick + 1) % segments;

    binormal.subVectors(tubeGeometry.binormals[pickNext], tubeGeometry.binormals[pick]);
    binormal.multiplyScalar(pickt - pick).add(tubeGeometry.binormals[pick]);

    missileBinormal.subVectors(tubeGeometry.binormals[missileNext], tubeGeometry.binormals[pick]);
    missileBinormal.multiplyScalar(pickt - pick).add(tubeGeometry.binormals[pick]);

    tubeGeometry.parameters.path.getTangentAt(t, direction);
    tubeGeometry.parameters.path.getTangentAt(t + 0.001, missileDirection);
    const offset = PARAMS.offset;

    normal.copy(binormal).cross(direction);
    missileNormal.copy(missileBinormal).cross(missileDirection);

    // we move on a offset on its binormal

    position.add(normal.clone().multiplyScalar(offset));
    missilePosition.add(missileNormal.clone().multiplyScalar(0));

    splineCamera.position.copy(position);
    missile.position.copy(missilePosition);
    birdViewCamera.position.copy(position);

    // using arclength for stablization in look ahead

    tubeGeometry.parameters.path.getPointAt((t + 30 / tubeGeometry.parameters.path.getLength()) % 1, lookAt);
    lookAt.multiplyScalar(1);

    tubeGeometry.parameters.path.getPointAt((t + 0.00001 + 30 / tubeGeometry.parameters.path.getLength()) % 1, missileLookAt);
    missileLookAt.multiplyScalar(1);

    // camera orientation 2 - up orientation via normal

    if (!PARAMS.lookAhead) lookAt.copy(position).add(direction);
    if (flagVerticalCamera)
        splineCamera.matrix.lookAt(splineCamera.position, tubeGeometry.parameters.path.getPointAt(t + 0.001), normal);
    else if (flagDefaultCamera)
        splineCamera.matrix.lookAt(splineCamera.position, lookAt, normal);
    else if (flagBirdEyeView)
        splineCamera.matrix.lookAt(splineCamera.position, tubeGeometry.parameters.path.getPointAt(t + 0.001), new THREE.Vector3(0, 1, 0));

    splineCamera.quaternion.setFromRotationMatrix(splineCamera.matrix);
    missile.matrix.lookAt(missile.position, missileLookAt, missileNormal);
    missile.quaternion.setFromRotationMatrix(missile.matrix);

    if (ti >= 1.0)
        reset();

    composer.render(0.01);
}

export default App;

// function renderStageOne() {
//     const time = stageOneClock.getElapsedTime();
//     const looptime = 2000 * 1;
//     const t = (time) / looptime;

//     let newPosition, tangent, radians;

//     if (t < 1) {
//         newPosition = missileBaseTrajectory.getPointAt(t);
//         tangent = missileBaseTrajectory.getTangent(t);
//         missileBase.position.copy(newPosition);
//         axis.crossVectors(up, tangent).normalize();
//         radians = Math.acos(up.dot(tangent));
//         missileBase.quaternion.setFromAxisAngle(axis, radians);

//         newPosition = missileBaseRTrajectory.getPointAt(t);
//         tangent = missileBaseRTrajectory.getTangent(t);
//         missileBaseR.position.copy(newPosition);
//         axis.crossVectors(up, tangent).normalize();
//         radians = Math.acos(up.dot(tangent));
//         missileBaseR.quaternion.setFromAxisAngle(axis, radians);

//         newPosition = missileBaseLTrajectory.getPointAt(t);
//         tangent = missileBaseLTrajectory.getTangent(t);
//         missileBaseL.position.copy(newPosition);
//         axis.crossVectors(up, tangent).normalize();
//         radians = Math.acos(up.dot(tangent));
//         missileBaseL.quaternion.setFromAxisAngle(axis, radians);
//     }
// }

// function renderStageTwo() {
//     const time = stageTwoClock.getElapsedTime();
//     const looptime = 2000 * 1;
//     const t = (time) / looptime;

//     let newPosition, tangent, radians;

//     if (t < 1) {
//         newPosition = stageTwoTrajectory.getPointAt(t);
//         tangent = stageTwoTrajectory.getTangent(t);
//         stageTwo.position.copy(newPosition);
//         axis.crossVectors(up, tangent).normalize();
//         radians = Math.acos(up.dot(tangent));
//         stageTwo.quaternion.setFromAxisAngle(axis, radians);
//     }
// }

// function jettisonStageOne(parentMissile) {
//     console.log("Jettison Stage One");
//     stageOneClock.start();

//     missileBase = parentMissile.children[0];
//     scene.attach(missileBase);

//     missileBaseR = parentMissile.children[parentMissile.children.length - 2];
//     scene.attach(missileBaseR);
//     missileBaseR.rotateX(Math.PI / 2);

//     missileBaseL = parentMissile.children[parentMissile.children.length - 1];
//     scene.attach(missileBaseL);
//     missileBaseL.rotateY(Math.PI / 2);

//     // create trajectory for jettison stage
//     missileBaseTrajectory = new THREE.CurvePath();
//     missileBaseTrajectory.add(new THREE.LineCurve3(missileBase.position, new THREE.Vector3(0, -25, 0)));
//     missileBaseRTrajectory = new THREE.CurvePath();
//     missileBaseRTrajectory.add(new THREE.LineCurve3(missileBaseR.position, new THREE.Vector3(10, -25, 0)));
//     missileBaseLTrajectory = new THREE.CurvePath();
//     missileBaseLTrajectory.add(new THREE.LineCurve3(missileBaseL.position, new THREE.Vector3(-10, -25, 0)));
// }

// function jettisonStageTwo(parentMissile) {
//     console.log("Jettison Stage Two");
//     stageTwoClock.start();

//     stageTwo = parentMissile.getObjectByName("stageTwo");
//     scene.attach(stageTwo);

//     // create trajectory for jettison stage
//     stageTwoTrajectory = new THREE.CurvePath();
//     stageTwoTrajectory.add(new THREE.LineCurve3(stageTwo.position, new THREE.Vector3(0, -25, 0)));
// } 