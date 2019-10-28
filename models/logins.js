module.exports = (sequelize, DataTypes) => {
  const Logins = sequelize.define('logins', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true
    },
    role: { type: DataTypes.STRING },
    firebase_login: { type: DataTypes.BOOLEAN, defaultValue: false },
    email: { 
      type: DataTypes.TEXT, 
      required: true,
      unique:true
    },
    password: { type: DataTypes.TEXT, allowNull: true },
    salt: { type: DataTypes.TEXT, allowNull: true },
    hotp_secret: { type: DataTypes.TEXT },
    counter: { type: DataTypes.TEXT },
    paytm_auth_token: { type: DataTypes.TEXT },
    withdrawable_wallet_balance: { type: DataTypes.TEXT },
    un_withdrawable_wallet_balance: { type: DataTypes.TEXT },
    bonus_wallet_balance: { type: DataTypes.TEXT },
    tax_due: { type: DataTypes.DECIMAL, defaultValue: 0.0 },
    uid: { type: DataTypes.TEXT, allowNull:false },
    pan: { type: DataTypes.JSON },
    firebase_uid: {
      type: DataTypes.TEXT,
      allowNull: true,
      unique: true
    },
    // Adds the bank info stored in the database
    bank: {type: DataTypes.JSON },
    bank_rejection_reason: { type: DataTypes.TEXT, allowNull: true },
    email_verified: { type: DataTypes.BOOLEAN },
    pan_verified: { type: DataTypes.INTEGER, defaultValue: 0 },
    pan_rejection_reason: {type: DataTypes.TEXT, allowNull:true },
    // aadhaar_verified: { type: DataTypes.BOOLEAN },
    bank_verified: { type: DataTypes.INTEGER, defaultValue: 0 },

    otp_2factor_session_id: {type: DataTypes.TEXT, allowNull: true},
    referrer_id : DataTypes.TEXT,
    spin_count: { 
      type: DataTypes.INTEGER, 
      defaultValue: 0,
      validate: {min:0}
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: new Date()
    },
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE
  }, {
      underscored: true
    });
  return Logins;
};

// withdrawable_wallet_balance: { type: DataTypes.DECIMAL(13, 6), defaultValue:0 },