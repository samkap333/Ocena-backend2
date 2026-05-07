const { ContactSubmission, CareerApplication } = require('../models/crm');

function buildPagination(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

exports.listContacts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'submittedAt', order = 'desc' } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [contacts, total] = await Promise.all([
      ContactSubmission.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean(),
      ContactSubmission.countDocuments(query),
    ]);

    res.json({ contacts, pagination: buildPagination(total, parsedPage, parsedLimit) });
  } catch (error) {
    next(error);
  }
};

exports.listCareers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      jobTitle,
      sortBy = 'appliedAt',
      order = 'desc',
    } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { jobTitle: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    if (jobTitle && jobTitle !== 'all') {
      query.jobTitle = jobTitle;
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [applications, total, jobs] = await Promise.all([
      CareerApplication.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean(),
      CareerApplication.countDocuments(query),
      CareerApplication.distinct('jobTitle'),
    ]);

    res.json({
      applications,
      jobs: jobs.filter(Boolean).sort(),
      pagination: buildPagination(total, parsedPage, parsedLimit),
    });
  } catch (error) {
    next(error);
  }
};
