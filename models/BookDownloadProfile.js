const mongoose = require('mongoose');

const RecommendationEntrySchema = new mongoose.Schema(
  {
    recommendationId: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    seedTitle: { type: String, default: '' },
    seedAuthor: { type: String, default: '' },
    workId: { type: Number },
    goodreadsUrl: { type: String, default: '' },
  },
  { _id: false }
);

const DownloadEntrySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    titleNormalized: { type: String, required: true, index: true },
    author: { type: String, default: '', trim: true },
    authorNormalized: { type: String, default: '' },
    source: { type: String, default: 'unknown', trim: true },
    bookId: { type: String, default: '', trim: true },
    format: { type: String, default: '', trim: true },
    downloadedAt: { type: Date, default: Date.now },
    bookSv: {
      workId: { type: Number },
      bookId: { type: Number },
      title: { type: String, default: '', trim: true },
      author: { type: String, default: '', trim: true },
      matchedAt: { type: Date },
    },
  },
  { _id: true }
);

const BookDownloadProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      unique: true,
      sparse: true,
    },
    ipHash: { type: String, index: true },
    lastIp: { type: String, default: '' },
    uaHash: { type: String, default: '' },
    downloads: { type: [DownloadEntrySchema], default: [] },
    downloadsFingerprint: { type: String, default: '' },
    recommendationCache: {
      items: { type: [RecommendationEntrySchema], default: [] },
      generatedAt: { type: Date },
      seedCount: { type: Number, default: 0 },
      downloadsFingerprint: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.BookDownloadProfile ||
  mongoose.model('BookDownloadProfile', BookDownloadProfileSchema);


