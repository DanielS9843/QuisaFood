const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Middleware
// 50mb limit is necessary to allow transmitting base64 image strings for cover and galleries
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
// Database Configuration & Initialization
// ==========================================================================
let sequelize;

if (process.env.DATABASE_URL) {
  console.log('Connecting to cloud PostgreSQL database...');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Necessary for hosting providers like Render / Neon
      }
    },
    logging: false
  });
} else {
  console.log('Connecting to local SQLite database...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
  });
}

// ==========================================================================
// Models Definition
// ==========================================================================
const Restaurant = sequelize.define('Restaurant', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  image: {
    type: DataTypes.TEXT, // Using TEXT to store base64 data URLs
    allowNull: false
  }
}, {
  timestamps: true
});

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false
  },
  rating: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  date: {
    type: DataTypes.STRING, // YYYY-MM-DD
    allowNull: false
  }
}, {
  timestamps: true
});

const AdditionalImage = sequelize.define('AdditionalImage', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  image: {
    type: DataTypes.TEXT, // Base64 gallery photos
    allowNull: false
  }
}, {
  timestamps: false
});

// Setup Relationships (CASCADE ensures that deleting a restaurant deletes its reviews & gallery images)
Restaurant.hasMany(Review, { as: 'reviews', foreignKey: 'restaurantId', onDelete: 'CASCADE' });
Review.belongsTo(Restaurant, { foreignKey: 'restaurantId' });

Restaurant.hasMany(AdditionalImage, { as: 'additionalImages', foreignKey: 'restaurantId', onDelete: 'CASCADE' });
AdditionalImage.belongsTo(Restaurant, { foreignKey: 'restaurantId' });

// ==========================================================================
// API REST Routes
// ==========================================================================

// 1. GET all restaurants (including associated reviews and additional images)
app.get('/api/restaurants', async (req, res) => {
  try {
    const list = await Restaurant.findAll({
      include: [
        { model: Review, as: 'reviews' },
        { model: AdditionalImage, as: 'additionalImages' }
      ],
      order: [
        ['createdAt', 'DESC']
      ]
    });

    // Formatting data structure to match frontend expectations
    const formatted = list.map(r => {
      const plain = r.get({ plain: true });
      return {
        id: plain.id,
        name: plain.name,
        category: plain.category,
        image: plain.image,
        additionalImages: plain.additionalImages.map(img => img.image),
        reviews: plain.reviews.map(rev => ({
          id: rev.id,
          author: rev.author,
          rating: parseFloat(rev.rating),
          description: rev.description,
          date: rev.date
        }))
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Error del servidor al obtener restaurantes.' });
  }
});

// 2. POST create a new restaurant (with initial review and optional additional images)
app.post('/api/restaurants', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id, name, category, image, additionalImages, reviews } = req.body;

    if (!id || !name || !category || !image || !reviews || reviews.length === 0) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para registrar el restaurante.' });
    }

    // Create Restaurant
    const newRest = await Restaurant.create({
      id,
      name,
      category,
      image
    }, { transaction });

    // Create associated initial review
    const initRev = reviews[0];
    await Review.create({
      id: initRev.id,
      author: initRev.author,
      rating: parseFloat(initRev.rating),
      description: initRev.description,
      date: initRev.date,
      restaurantId: id
    }, { transaction });

    // Create associated additional images if any
    if (additionalImages && additionalImages.length > 0) {
      const imageRecords = additionalImages.map((imgBase64, idx) => ({
        id: `img-${id}-${Date.now()}-${idx}`,
        image: imgBase64,
        restaurantId: id
      }));
      await AdditionalImage.bulkCreate(imageRecords, { transaction });
    }

    await transaction.commit();
    res.status(201).json({ success: true, message: 'Restaurante creado con éxito.' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Error al registrar el restaurante en la base de datos.' });
  }
});

// 3. PUT edit restaurant metadata and gallery images (keeps reviews intact)
app.put('/api/restaurants/:id', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, category, image, additionalImages } = req.body;

    const rest = await Restaurant.findByPk(id);
    if (!rest) {
      return res.status(404).json({ error: 'Restaurante no encontrado.' });
    }

    // Update metadata
    await rest.update({
      name,
      category,
      image
    }, { transaction });

    // Refresh additional images (delete existing, bulk insert new)
    await AdditionalImage.destroy({
      where: { restaurantId: id },
      transaction
    });

    if (additionalImages && additionalImages.length > 0) {
      const imageRecords = additionalImages.map((imgBase64, idx) => ({
        id: `img-${id}-${Date.now()}-${idx}`,
        image: imgBase64,
        restaurantId: id
      }));
      await AdditionalImage.bulkCreate(imageRecords, { transaction });
    }

    await transaction.commit();
    res.json({ success: true, message: 'Restaurante actualizado con éxito.' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Error al actualizar el restaurante.' });
  }
});

// 4. POST add a new review to a restaurant
app.post('/api/restaurants/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { id: revId, author, rating, description, date } = req.body;

    const rest = await Restaurant.findByPk(id);
    if (!rest) {
      return res.status(404).json({ error: 'Restaurante no encontrado.' });
    }

    if (!revId || !author || isNaN(rating) || !description || !date) {
      return res.status(400).json({ error: 'Faltan campos requeridos para la reseña.' });
    }

    const newReview = await Review.create({
      id: revId,
      author,
      rating: parseFloat(rating),
      description,
      date,
      restaurantId: id
    });

    res.status(201).json(newReview);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Error al crear la reseña.' });
  }
});

// 4.5. PUT edit a specific review
app.put('/api/restaurants/:id/reviews/:reviewId', async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { author, rating, description, date } = req.body;

    const review = await Review.findOne({
      where: {
        id: reviewId,
        restaurantId: id
      }
    });

    if (!review) {
      return res.status(404).json({ error: 'Reseña no encontrada.' });
    }

    if (!author || isNaN(rating) || !description || !date) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    await review.update({
      author,
      rating: parseFloat(rating),
      description,
      date
    });

    res.json(review);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Error al actualizar la reseña.' });
  }
});

// 5. DELETE a specific review from a restaurant
app.delete('/api/restaurants/:id/reviews/:reviewId', async (req, res) => {
  try {
    const { id, reviewId } = req.params;

    const affectedRows = await Review.destroy({
      where: {
        id: reviewId,
        restaurantId: id
      }
    });

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Reseña no encontrada o no pertenece al restaurante especificado.' });
    }

    res.json({ success: true, message: 'Reseña eliminada con éxito.' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Error al eliminar la reseña.' });
  }
});

// 6. DELETE a restaurant (and all associated data via Cascade)
app.delete('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const affectedRows = await Restaurant.destroy({
      where: { id }
    });

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Restaurante no encontrado.' });
    }

    res.json({ success: true, message: 'Restaurante y opiniones eliminados de la base de datos.' });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ error: 'Error al eliminar el restaurante.' });
  }
});

// Fallback to SPA index.html for undefined routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================================================
// DB Connection and Server Boot
// ==========================================================================
sequelize.sync({ alter: true }) // Syncs columns cleanly without wiping unless incompatible changes are made
  .then(async () => {
    console.log('Database synchronized successfully.');
    
    // Seed initial mock data if database is empty
    const count = await Restaurant.count();
    if (count === 0) {
      console.log('Seeding database with default mock restaurants...');
      
      const defaultRestaurants = [
        {
          id: 'mock-1',
          name: 'La Piazza',
          category: 'Italiana',
          image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
          reviews: [
            {
              id: 'mock-rev-1a',
              author: 'Dani Sandoval',
              rating: 4.8,
              description: 'El mejor risoto de setas que he probado en años. El ambiente rústico con luces tenues y velas te transporta directamente a la Toscana. El tiramisú casero es una parada obligatoria.',
              date: '2026-05-15'
            },
            {
              id: 'mock-rev-1b',
              author: 'Isabel G.',
              rating: 3.7,
              description: 'La lasagna estaba riquísima, pero las mesas están un poco juntas. Aún así, súper recomendado.',
              date: '2026-05-20'
            }
          ],
          additionalImages: [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80'
          ]
        },
        {
          id: 'mock-2',
          name: 'Sakura Sushi Bar',
          category: 'Asiática',
          image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
          reviews: [
            {
              id: 'mock-rev-2a',
              author: 'Carlos M.',
              rating: 4.5,
              description: 'El pescado estaba increíblemente fresco y cortado a la perfección. El rollo especial "Dragón Flameado" es un espectáculo tanto visual como de sabor.',
              date: '2026-05-28'
            }
          ],
          additionalImages: [
            'https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&auto=format&fit=crop&q=80'
          ]
        },
        {
          id: 'mock-3',
          name: 'The Burger Lab',
          category: 'Comida Rápida',
          image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
          reviews: [
            {
              id: 'mock-rev-3a',
              author: 'Dani Sandoval',
              rating: 5.0,
              description: 'Hamburguesas gourmet espectaculares. La carne Black Angus estaba en su punto perfecto de cocción y el pan brioche súper tierno.',
              date: '2026-04-10'
            },
            {
              id: 'mock-rev-3b',
              author: 'Lucía Ortiz',
              rating: 4.2,
              description: 'Las hamburguesas son de primer nivel. Las patatas rústicas con queso de cabra son una delicia total.',
              date: '2026-04-15'
            }
          ],
          additionalImages: [
            'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80'
          ]
        },
        {
          id: 'mock-4',
          name: 'Bistro Origen',
          category: 'Cafetería / Bakery',
          image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&auto=format&fit=crop&q=80',
          reviews: [
            {
              id: 'mock-rev-4a',
              author: 'Alejandra P.',
              rating: 4.0,
              description: 'Un rincón súper acogedor y relajado, ideal para leer o trabajar un rato. Su tarta de zanahoria es extremadamente esponjosa.',
              date: '2026-05-02'
            }
          ],
          additionalImages: []
        }
      ];

      for (const item of defaultRestaurants) {
        await Restaurant.create({
          id: item.id,
          name: item.name,
          category: item.category,
          image: item.image
        });

        for (const rev of item.reviews) {
          await Review.create({
            id: rev.id,
            author: rev.author,
            rating: rev.rating,
            description: rev.description,
            date: rev.date,
            restaurantId: item.id
          });
        }

        for (const img of item.additionalImages) {
          await AdditionalImage.create({
            id: `img-${item.id}-${Math.floor(Math.random() * 100000)}`,
            image: img,
            restaurantId: item.id
          });
        }
      }
      console.log('Seeding completed successfully.');
    }

    app.listen(PORT, () => {
      console.log(`Server is running in production mode.`);
      console.log(`Access locally at: http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to synchronize database:', err);
  });
