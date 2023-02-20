import './style.css'

// import { createApp } from 'vue'
// import App from './App.vue'

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GUI } from 'dat.gui'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

const terrainSize = 512;
const terrainSizeBig = 4096;
let terrainMat;

const defHeightMapURL = './src/assets/DefaultHeightMap.png';
const defDefuseMapURL = './src/assets/DefaultDefuseMap.png';
const heightMapScale = 5;

class TerrainRender {
    constructor() {
        this._Initialize();
    }

    async _Initialize() {
        this._threejs = new THREE.WebGLRenderer({
            antialias: true,
            canvas: document.querySelector('#container')
        });
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        this._threejs.toneMapping = THREE.ReinhardToneMapping;
        this._threejs.toneMappingExposure = 2.3;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setSize(window.innerWidth, window.innerHeight);

        window.addEventListener('resize', () => {
            this._OnWindowResize();
        }, false);

        const gui = new GUI();

        const loader = new THREE.TextureLoader();
        const defaultHeightMap = loadTexture(defHeightMapURL);
        const defaultDefuseMap = loadTexture(defDefuseMapURL);

        const fov = 60;
        const aspect = (window.innerWidth * .5) / window.innerHeight;
        const near = 1.0;
        const far = 1000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(100, 60, 0);
        this._camera.setViewOffset(window.innerWidth * 1, window.innerHeight, window.innerWidth * -0.2, window.innerHeight * .05, window.innerWidth, window.innerHeight)

        this._scene = new THREE.Scene();

        let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
        light.position.set(20, 100, 10);
        light.target.position.set(0, 0, 0);
        light.castShadow = true;
        light.shadow.bias = -0.001;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.left = 100;
        light.shadow.camera.right = -100;
        light.shadow.camera.top = 100;
        light.shadow.camera.bottom = -100;
        this._scene.add(light);

        light = new THREE.AmbientLight(0x101010);
        this._scene.add(light);

        const controls = new OrbitControls(
            this._camera, this._threejs.domElement);

        controls.enablePan = false;
        controls.maxPolarAngle = Math.PI / 2;
        controls.minDistance = 40;
        controls.maxDistance = 170;
        controls.update();

        const link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link);

        var terrainGeo = new THREE.PlaneGeometry(50, 50, terrainSize - 1, terrainSize - 1);
        terrainGeo.dynamic = true;
        terrainMat = new THREE.MeshStandardMaterial({
            // color: 'gray',
            map: defaultDefuseMap,
            fog: true
        });

        gui.add(terrainMat, 'wireframe', true, false).name('Wireframe');
        // gui.add(heightMapScale, 1, 10).name('Scale');

        bakeDisplacement(defHeightMapURL, heightMapScale);

        var terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.castShadow = false;
        terrain.receiveShadow = true;
        terrain.rotation.x = -Math.PI / 2;
        terrain.rotation.z = 38;
        terrain.position.y = -5;

        this._scene.add(terrain);

        this._RAF();

        var userHeightMap = "";
        var userHeightMapURL = "";
        var userInput = document.querySelector('#userInput');

        userInput.addEventListener("change", function () {
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                userHeightMapURL = reader.result;
                userHeightMap = loadTexture(userHeightMapURL);
            });

            if (this.files[0]) {
                reader.readAsDataURL(this.files[0]);
            }
        });

        document.querySelector('#generate').addEventListener("mousedown", terrainHeightMap);

        function terrainHeightMap() {
            terrainMat.map = userHeightMap;
            bakeDisplacement(userHeightMapURL, heightMapScale);
        }

        document.querySelector('#download').addEventListener("mousedown", exportTerrain);

        function exportTerrain() {
            exportGLTF(terrain);
        }

        function exportGLTF(input) {
            const gltfExporter = new GLTFExporter();

            const params = {
                trs: false,
                onlyVisible: true,
                binary: false,
                maxTextureSize: 4096,
                exportTerrain: exportTerrain,
            };

            const options = {
                trs: params.trs,
                onlyVisible: params.onlyVisible,
                binary: params.binary,
                maxTextureSize: params.maxTextureSize
            };

            gltfExporter.parse(
                input,
                function (result) {
                    if (result instanceof ArrayBuffer) {

                        saveArrayBuffer(result, 'terrain.glb');

                    } else {

                        const output = JSON.stringify(result, null, 2);
                        console.log(output);
                        saveString(output, 'terrain.gltf');

                    }
                },
                function (error) {

                    console.log('An error happened during parsing', error);

                },
                options
            );
        }

        function save(blob, fileName) {
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
        }

        function saveString(text, filename) {
            save(new Blob([text], { type: 'text/plain' }), filename);

        }

        function saveArrayBuffer(buffer, fileName) {
            save(new Blob([buffer], { type: 'application/octet-stream' }, fileName));
        }

        function bakeDisplacement(heightmap, scale) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = heightmap;
            const canvas = document.getElementById("canvas2D");
            canvas.getContext("2d", { willReadFrequently: true })
            const ctx = canvas.getContext("2d");
            img.addEventListener("load", () => {
                ctx.drawImage(img, 0, 0, terrainSize, terrainSize);

                var vertices = terrainGeo.attributes.position.array;

                let i = 0;
                for (var x = 0; x < terrainSize; x++) {
                    for (var y = 0; y < terrainSize; y++) {
                        const pixel = ctx.getImageData(x, y, 1, 1);
                        vertices[i + 2] = (pixel.data[0] / 256) * scale;
                        i = i + 3
                    }
                }

                terrainGeo.computeVertexNormals();
                terrainGeo.verticesNeedUpdate = true;
                terrainGeo.attributes.position.needsUpdate = true;
            });
        }

        function loadTexture(img) {
            var map = loader.load(img);
            map.rotation = Math.PI / 2;
            map.center = new THREE.Vector2(0.5, 0.5);
            map.repeat.x = - 1;
            return map;
        }

        function resizeImg(img, height, width) {
            img.height = height;
            img.width = width;
        }
    }

    _OnWindowResize() {
        this._camera.aspect = (window.innerWidth) / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _RAF() {
        requestAnimationFrame(() => {
            this._threejs.render(this._scene, this._camera);
            this._RAF();
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getRandomNumberBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
}



let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new TerrainRender();
});

const app = createApp(App).mount('#app');