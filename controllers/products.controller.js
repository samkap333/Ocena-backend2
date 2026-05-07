const { Product } = require('../models/crm');

// Get all products
exports.list = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      type,
      category,
      isActive,
      sortBy = 'name',
      order = 'asc',
    } = req.query;

    const query = { tenantId: req.user.tenantId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query),
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single product
exports.get = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
};

// Create product
exports.create = async (req, res, next) => {
  try {
    const productData = {
      ...req.body,
      tenantId: req.user.tenantId,
    };

    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

// Update product
exports.update = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
};

// Delete product
exports.remove = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Get product statistics
exports.stats = async (req, res, next) => {
  try {
    const query = { tenantId: req.user.tenantId };

    const [total, active, typeCounts] = await Promise.all([
      Product.countDocuments(query),
      Product.countDocuments({ ...query, isActive: true }),
      Product.aggregate([
        { $match: query },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    const stats = {
      total,
      active,
      inactive: total - active,
      product: 0,
      service: 0,
      subscription: 0,
    };

    typeCounts.forEach((item) => {
      stats[item._id] = item.count;
    });

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// Get categories
exports.categories = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category', {
      tenantId: req.user.tenantId,
      category: { $ne: null, $ne: '' },
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
};
