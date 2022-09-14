import * as THREE from 'three';
import * as POSTPROCESSING from 'postprocessing';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';
import { CurvePath } from 'three';

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

let iss;
const up = new THREE.Vector3(0, 1, 0);
const axis = new THREE.Vector3();

// missile childs
let missileOrig;
let missileBase, missileBaseTrajectory;
let missileBaseR, missileBaseRTrajectory;
let missileBaseL, missileBaseLTrajectory;
let stageTwo, stageTwoTrajectory;

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


const PARAMS = {
    offset: 0.12,
    lookAhead: false,
    earthColor: 0x030303
};

const pane = new Tweakpane.Pane();

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

class App {

    init() {

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 151000);

        camera.position.set(0, 0.01, 0);

        const light = new THREE.AmbientLight(0xA0A0A0, 4); // soft white light
        scene.add(light);

        let directionalLight = new THREE.DirectionalLight(0x888888, 1);
        directionalLight.position.set(0, 1, -1);
        scene.add(directionalLight);

        const material = new THREE.LineBasicMaterial({
            color: 0x0000ff
        });

        const point1 = [0, -5, 0]; // Point 1 coordinates
        const point2 = [100, -5, 0]; // Point 2 coordinates
        const controlPoint = [0, 624, 0]; // Control point coordinates

        // Create a 3D quadratic Bezier curve
        lineCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(point1[0], point1[1], point1[2]),
            new THREE.Vector3(controlPoint[0], controlPoint[1], controlPoint[2]),
            new THREE.Vector3(point2[0], point2[1], point2[2])
        );

        const divisions = 1000; // Number of segments of the curve
        points = lineCurve.getPoints(divisions); // Return the number of segments + 1 point, such as points The length is 31

        // Create Geometry
        lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        // geometry.vertices = points; // Assign the point list obtained in the previous step to the vertices attribute of geometry

        tubeGeometry = new THREE.TubeGeometry(lineCurve, 100, 1, 3, false);

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
            color: 0x444444,
            linewidth: 10,
            linecap: 'round', //ignored by WebGLRenderer
            linejoin: 'round' //ignored by WebGLRenderer
        });

        const mesh = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(mesh);

        // var envmap = new RGBELoader().load( "./assets/studio_small_06_4k.hdr" );
        // scene.environment = envmap;

        const manager = new THREE.LoadingManager();
        manager.onStart = function (url, itemsLoaded, itemsTotal) {
            console.log('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
        };

        manager.onLoad = function () {
            console.log('Loading complete!');
            console.log(missile);
            missile.name = "missile";
            missileOrig = missile.clone();

            console.log("Missile Cloone");
            console.log(missileOrig);

            clock.start();

            animate();

            // window.onwheel = function(event) {
            //     if(event.deltaY > 0)
            //         renderCamera(1);
            //     else
            //         renderCamera(-1);
            // };

            // window.onmousemove = function(event) {
            // 	let x = event.clientX;
            // 	let y = event.clientY;

            // 	renderChange(x, y);
            // }
        };


        manager.onProgress = function (url, itemsLoaded, itemsTotal) {
            console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
        };

        manager.onError = function (url) {
            console.log('There was an error loading ' + url);
        };

        // Instantiate a loader
        const loader = new GLTFLoader(manager);

        // Load a glTF resource
        // loader.load(
        //     // resource URL
        //     '../models/earth.glb',
        //     // called when the resource is loaded
        //     function ( gltf ) {

        //         earth = gltf.scene;

        //         earth.scale.set(1, 1, 1);
        //         earth.position.set(0, -1200/2, 0);
        //         let earthPARAMS = {
        //             x: 5.33,
        //             y: 3.82,
        //             z: 4.92
        //         };
        //         earth.rotation.set(earthPARAMS.x, earthPARAMS.y, earthPARAMS.z);
        //         scene.add( earth );

        //         earth.visible = false;

        //     },
        //     // called while loading is progressing
        //     function ( xhr ) {

        //         // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

        //     },
        //     // called when loading has errors
        //     function ( error ) {

        //         console.log( 'An error happened' );

        //     }
        // );

        // Load a glTF resource
        loader.load(
            // resource URL
            '../models/iss.glb',
            // called when the resource is loaded
            function (gltf) {

                iss = gltf.scene;

                iss.scale.set(1, 1, 1);
                iss.position.set(0, 40, 20);
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

        // Load a glTF resource
        // loader.load(
        //     // resource URL
        //     '../models/land.glb',
        //     // called when the resource is loaded
        //     function ( gltf ) {

        //         land = gltf.scene;

        //         land.position.set(0, 0, 0);
        //         land.scale.set(1, 1, 1);
        //         scene.add( land );

        //     },
        //     // called while loading is progressing
        //     function ( xhr ) {

        //         // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

        //     },
        //     // called when loading has errors
        //     function ( error ) {

        //         console.log( 'An error happened' );

        //     }
        // );

        // Load a glTF resource
        loader.load(
            // resource URL
            '../models/hwasong_scratch.glb',
            // called when the resource is loaded
            function (gltf) {

                missile = gltf.scene;

                missile.traverse((o) => {
                    if (o.isMesh) o.material = matcapMat;
                });

                missile.position.set(0, 0, 0);
                missile.scale.set(0.03, 0.03, 0.03);
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

        const texLoader = new THREE.TextureLoader();

        // load a resource
        texLoader.load(
            // resource URL
            '../assets/yellow_matcap.png',

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

        let earthGeo = new THREE.SphereGeometry(600, 32, 24);
        // let earthMat = new THREE.MeshBasicMaterial({color: 0xffccaa});
        let earthMat = new THREE.MeshPhysicalMaterial({
            color: PARAMS.earthColor,
            roughness: 0.58,
            metalness: 0.478,
            reflectivity: 0.389
        });
        earthMat.shading = THREE.SmoothShading;
        earth = new THREE.Mesh(earthGeo, earthMat);
        earth.position.set(0, -1200 / 2, 0);
        scene.add(earth);

        let circleGeo = new THREE.CircleGeometry(220, 50);
        let circleMat = new THREE.MeshBasicMaterial({ color: 0xffccaa });
        let circle = new THREE.Mesh(circleGeo, circleMat);
        circle.position.set(1500, 500, 0);
        circle.scale.setX(1.2);
        circle.lookAt(new THREE.Vector3(0, 0, 0));
        scene.add(circle);

        renderer = new THREE.WebGLRenderer({
            powerPreference: "high-performance",
            antialias: true,
            stencil: false,
            depth: false
        });
        // renderer.toneMappingExposure = Math.pow(0.7, 1.0);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ReinhardToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.physicallyCorrectLights = true;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.autoClear = false;
        renderer.setClearColor(0xffffff);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        //HDRI LOADER
        var envmaploader = new THREE.PMREMGenerator(renderer);
        const loadhdri = new RGBELoader().load("../assets/starmap_4k.hdr", function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
            scene.envmap
        });

        // controls = new OrbitControls( camera, renderer.domElement );
        // controls.enablePan = false;
        // controls.enableZoom = false;
        // controls.maxDistance = 1200;
        // controls.autoRotate = false;
        // controls.update();

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

        renderPass = new POSTPROCESSING.RenderPass(scene, splineCamera);
        effectPass = new POSTPROCESSING.EffectPass(splineCamera, godraysEffect);
        effectPass.renderToScreen = true;

        composer = new POSTPROCESSING.EffectComposer(renderer);
        composer.addPass(renderPass);
        composer.addPass(effectPass);
    }

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

function render() {

    // animate camera along spline

    const time = clock.getElapsedTime();
    const looptime = 20 * 1;
    const t = (time % looptime) / looptime;

    tubeGeometry.parameters.path.getPointAt(t, position);
    position.multiplyScalar(1);
    tubeGeometry.parameters.path.getPointAt(t + 0.001, missilePosition);
    missilePosition.multiplyScalar(1);

    // interpolation

    const segments = tubeGeometry.tangents.length;
    const pickt = t * segments;
    const pick = Math.floor(pickt);
    const pickNext = (pick + 1) % segments;
    const missileNext = (pick + 1) % segments;

    binormal.subVectors(tubeGeometry.binormals[pickNext], tubeGeometry.binormals[pick]);
    binormal.multiplyScalar(pickt - pick).add(tubeGeometry.binormals[pick]);

    missileBinormal.subVectors(tubeGeometry.binormals[missileNext + 1], tubeGeometry.binormals[missileNext]);
    missileBinormal.multiplyScalar(pickt - missileNext).add(tubeGeometry.binormals[missileNext]);

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

    tubeGeometry.parameters.path.getPointAt((t + 0.001 + 30 / tubeGeometry.parameters.path.getLength()) % 1, missileLookAt);
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

    if (t > 0.25) {
        if (!missileBaseTrajectory) {
            jettisonStageOne(missile);
        }

        renderStageOne();
    }

    if (t > 0.4) {
        if (!stageTwoTrajectory) {
            jettisonStageTwo(missile);
        }

        renderStageTwo();
    }

    if (t > 0.98)
        reset();

    composer.render(0.01);
}

function renderStageOne() {
    const time = stageOneClock.getElapsedTime();
    const looptime = 2000 * 1;
    const t = (time) / looptime;

    let newPosition, tangent, radians;

    if (t < 1) {
        newPosition = missileBaseTrajectory.getPointAt(t);
        tangent = missileBaseTrajectory.getTangent(t);
        missileBase.position.copy(newPosition);
        axis.crossVectors(up, tangent).normalize();
        radians = Math.acos(up.dot(tangent));
        missileBase.quaternion.setFromAxisAngle(axis, radians);

        newPosition = missileBaseRTrajectory.getPointAt(t);
        tangent = missileBaseRTrajectory.getTangent(t);
        missileBaseR.position.copy(newPosition);
        axis.crossVectors(up, tangent).normalize();
        radians = Math.acos(up.dot(tangent));
        missileBaseR.quaternion.setFromAxisAngle(axis, radians);

        newPosition = missileBaseLTrajectory.getPointAt(t);
        tangent = missileBaseLTrajectory.getTangent(t);
        missileBaseL.position.copy(newPosition);
        axis.crossVectors(up, tangent).normalize();
        radians = Math.acos(up.dot(tangent));
        missileBaseL.quaternion.setFromAxisAngle(axis, radians);
    }
}

function renderStageTwo() {
    const time = stageTwoClock.getElapsedTime();
    const looptime = 2000 * 1;
    const t = (time) / looptime;

    let newPosition, tangent, radians;

    if (t < 1) {
        newPosition = stageTwoTrajectory.getPointAt(t);
        tangent = stageTwoTrajectory.getTangent(t);
        stageTwo.position.copy(newPosition);
        axis.crossVectors(up, tangent).normalize();
        radians = Math.acos(up.dot(tangent));
        stageTwo.quaternion.setFromAxisAngle(axis, radians);
    }
}

function jettisonStageOne(parentMissile) {
    console.log("Jettison Stage One");
    stageOneClock.start();

    missileBase = parentMissile.children[0];
    scene.attach(missileBase);

    missileBaseR = parentMissile.children[parentMissile.children.length - 2];
    scene.attach(missileBaseR);
    missileBaseR.rotateX(Math.PI / 2);

    missileBaseL = parentMissile.children[parentMissile.children.length - 1];
    scene.attach(missileBaseL);
    missileBaseL.rotateY(Math.PI / 2);

    // create trajectory for jettison stage
    missileBaseTrajectory = new THREE.CurvePath();
    missileBaseTrajectory.add(new THREE.LineCurve3(missileBase.position, new THREE.Vector3(0, -25, 0)));
    missileBaseRTrajectory = new THREE.CurvePath();
    missileBaseRTrajectory.add(new THREE.LineCurve3(missileBaseR.position, new THREE.Vector3(10, -25, 0)));
    missileBaseLTrajectory = new THREE.CurvePath();
    missileBaseLTrajectory.add(new THREE.LineCurve3(missileBaseL.position, new THREE.Vector3(-10, -25, 0)));
}

function jettisonStageTwo(parentMissile) {
    console.log("Jettison Stage Two");
    stageTwoClock.start();

    stageTwo = parentMissile.getObjectByName("stageTwo");
    scene.attach(stageTwo);

    // create trajectory for jettison stage
    stageTwoTrajectory = new THREE.CurvePath();
    stageTwoTrajectory.add(new THREE.LineCurve3(stageTwo.position, new THREE.Vector3(0, -25, 0)));
}

function reset() {
    scene.remove(missile);
    scene.remove(missileBase);
    scene.remove(missileBaseR);
    scene.remove(missileBaseL);
    scene.remove(stageTwo);
    missileBase = null;
    missileBaseTrajectory = null;
    stageTwoTrajectory = null;
    missile = new THREE.Object3D();
    missile = missileOrig.clone();
    scene.add(missile);
    clock.stop();
    clock.start();
    stageOneClock.stop();
    stageTwoClock.stop();
}


export default App;