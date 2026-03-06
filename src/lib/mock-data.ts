import type { InventoryItem } from './types';

export const InventoryItems: InventoryItem[] = [
  // ── Electrónica ─────────────────────────────────────────────────────────
  {
    id: 'up-e01',
    name: 'Módulo Relay 4 Canales 5V',
    category: 'Electrónica',

    description: 'Relay de estado sólido para automatización de circuitos',
    unit: 'pcs',
    stock: 50,
    purchasePrice: 3.2,
    salePrice: 6.5,
    imageUrl: '/images/product-placeholder.svg',
    reorderPoint: 10,
    qrCode: 'e01-relay-4ch-5v-a1b2c3d4',
  },
  {
    id: 'up-e02',
    name: 'Sensor DHT22 Temperatura/Humedad',
    category: 'Electrónica',

    description: 'Sensor digital de temperatura y humedad relativa',
    unit: 'pcs',
    stock: 30,
    purchasePrice: 2.8,
    salePrice: 5.9,
    imageUrl: '/images/product-placeholder.svg',
    reorderPoint: 5,
    qrCode: 'e02-dht22-temp-e5f6g7h8',
  },
  {
    id: 'up-e03',
    name: 'Pantalla OLED 0.96" I2C',
    category: 'Electrónica',

    description: 'Pantalla OLED monocromática 128x64 con interfaz I2C',
    unit: 'pcs',
    stock: 8,
    purchasePrice: 1.9,
    salePrice: 4.25,
    imageUrl: '/images/product-placeholder.svg',
    reorderPoint: 3,
    qrCode: 'e03-oled-096-i2c-i9j0k1l2',
  },
  {
    id: 'up-e04',
    name: 'Driver Motor L298N',
    category: 'Electrónica',

    description: 'Puente H doble para control de motores DC y paso a paso',
    unit: 'pcs',
    stock: 0,
    purchasePrice: 1.5,
    salePrice: 3.75,
    imageUrl: '/images/product-placeholder.svg',
    reorderPoint: 5,
    qrCode: 'e04-l298n-driver-m3n4o5p6',
  },

  // ── Automotriz ───────────────────────────────────────────────────────────
  {
    id: 'up-a01',
    name: 'Filtro de Aceite Bosch F026407001',
    category: 'Automotriz',

    description: 'Compatible con Volkswagen Golf IV, Jetta, Audi A3 1.6/1.8T',
    unit: 'Unidad',
    stock: 24,
    purchasePrice: 4.5,
    salePrice: 9.0,
    imageUrl: '/images/product-placeholder.svg',
    techSheetUrl: 'https://drive.google.com/uc?export=view&id=1Abc123',
    reorderPoint: 5,
    qrCode: 'a01-bosch-f026407001-q7r8s9t0',
  },
  {
    id: 'up-a02',
    name: 'Pastilla de Freno Delantera Brembo P85020',
    category: 'Automotriz',

    description: 'Honda Civic 2012-2021, Honda CR-V 2015-2021 — eje delantero',
    unit: 'Juego',
    stock: 12,
    purchasePrice: 18.0,
    salePrice: 34.5,
    imageUrl: '/images/product-placeholder.svg',
    techSheetUrl: 'https://drive.google.com/uc?export=view&id=1Def456',
    reorderPoint: 3,
    qrCode: 'a02-brembo-p85020-u1v2w3x4',
  },
  {
    id: 'up-a03',
    name: 'Bujía NGK Iridium BKR6EIX',
    category: 'Automotriz',

    description: 'Toyota Corolla, Camry, RAV4 — motor 1ZZ-FE / 2AZ-FE',
    unit: 'Unidad',
    stock: 3,
    purchasePrice: 6.0,
    salePrice: 12.0,
    imageUrl: '/images/product-placeholder.svg',
    reorderPoint: 8,
    qrCode: 'a03-ngk-bkr6eix-y5z6a7b8',
  },

  // ── Tapicería ────────────────────────────────────────────────────────────
  {
    id: 'up-t01',
    name: 'Hilo Nylon 210D/3 Negro',
    category: 'Tapicería',

    description: 'Hilo de nylon trenzado calibre 210D/3, alta resistencia UV',
    unit: 'Rollo 500m',
    stock: 18,
    purchasePrice: 7.5,
    salePrice: 14.0,
    imageUrl: '/images/product-placeholder.svg',
    reorderPoint: 4,
    qrCode: 't01-hilo-nylon-210d-c9d0e1f2',
  },
  {
    id: 'up-t02',
    name: 'Espuma de Poliuretano HR-40 2"',
    category: 'Tapicería',

    description: 'Espuma alta resiliencia densidad 40 kg/m³, plancha 200×100 cm',
    unit: 'Plancha',
    stock: 6,
    purchasePrice: 22.0,
    salePrice: 40.0,
    imageUrl: '/images/product-placeholder.svg',
    techSheetUrl: 'https://drive.google.com/uc?export=view&id=1Ghi789',
    reorderPoint: 2,
    qrCode: 't02-espuma-hr40-g3h4i5j6',
  },
  {
    id: 'up-t03',
    name: 'Tela Cuero Sintético PVC Café',
    category: 'Tapicería',

    description: 'Cuero sintético PVC estampado con textura grain, ancho 140 cm',
    unit: 'Metro',
    stock: 0,
    purchasePrice: 5.8,
    salePrice: 11.5,
    imageUrl: '/images/product-placeholder.svg',
    reorderPoint: 10,
    qrCode: 't03-cuero-pvc-cafe-k7l8m9n0',
  },
];

