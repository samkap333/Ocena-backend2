function validate(schema) {
  return (req, res, next) => {
    if (!schema) {
      return next();
    }

    const result = schema.safeParse ? schema.safeParse(req.body) : { success: true, data: req.body };
    if (!result.success) {
      return res.status(400).json({ message: 'Validation failed', errors: result.error?.issues || result.error });
    }

    req.body = result.data;
    return next();
  };
}

module.exports = validate;
