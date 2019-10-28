module.exports = (sequelize, DataTypes) => {
  const Profiles = sequelize.define('profiles', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true
    },
    

    login_id: { type: DataTypes.BIGINT },
    full_name: { type: DataTypes.TEXT, allowNull:true },
    phone: { 
      type: DataTypes.STRING, 
      allowNull:true,
      unique: true 
    },
    phone_verified: {type: DataTypes.BOOLEAN, defaultValue: false},
    dob: { type: DataTypes.STRING, allowNull:true },
    state: { type: DataTypes.STRING, allowNull:true },
    pincode: { type: DataTypes.TEXT, allowNull:true },
    score: { type: DataTypes.TEXT, allowNull: true },
    team_name: { type: DataTypes.TEXT },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: new Date()
    },
    updated_at:  DataTypes.DATE,
    deleted_at: DataTypes.DATE
  }, {
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['team_name']
      }
    ]
  });
  return Profiles;
};
