import * as Yup from 'yup';
import Sequelize from 'sequelize';
import Order from '../models/Order';
import User from '../models/User';
import File from '../models/File';
import Offer from '../models/Offer';

class OrderController {
  async store(req, res) {
    const schema = Yup.object().shape({
      subject: Yup.string().required(),
      description: Yup.string().required(),
      educationLevel: Yup.number().required(),
      studyArea: Yup.number().required(),
      dueDate: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) { return res.status(400).json({ error: 'Data validation failed' }); }

    const { userId } = req;

    const {
      subject, description, educationLevel, studyArea, dueDate,
    } = req.body;

    // eslint-disable-next-line no-use-before-define
    if (!isValidDate(dueDate)) { return res.status(400).json({ error: 'Due date is invalid' }); }

    const due_date = Date.parse(dueDate);

    const { name } = await User.findByPk(userId);

    const order = await Order.create({
      subject,
      description,
      education_level: educationLevel,
      study_area: studyArea,
      due_date,
      user_id: userId,
      status: 1,
      name_user: name,
    });

    return res.json(order);
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      subject: Yup.string(),
      description: Yup.string(),
      educationLevel: Yup.number(),
      studyArea: Yup.number(),
      dueDate: Yup.string(),
      status: Yup.number(),
      selectedOffer: Yup.number(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Data validation failed' });
    }

    if (req.body.dueDate) {
      // eslint-disable-next-line no-use-before-define
      if (!isValidDate(req.body.dueDate)) {
        return res.status(400).json({ error: 'Due date is invalid' });
      }
    }

    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(400).json({ error: 'Order does not exists' });
    }

    const { userId } = req;

    /* if (order.user_id !== userId) {
      return res.status(401).json({ error: 'Request unauthorized' });
    } */

    const {
      subject, description, educationLevel, studyArea, dueDate, status, selectedOffer,
    } = req.body;

    const ret = await order.update({
      subject,
      description,
      education_level: educationLevel,
      study_area: studyArea,
      due_date: dueDate,
      status,
      selected_offer_id: selectedOffer,
    });

    return res.json({
      id: ret.id,
      subject: ret.subject,
      description: ret.description,
      educationLevel: ret.education_level,
      studyArea: ret.study_area,
      dueDate: ret.due_date,
      userId: ret.user_id,
      status: ret.status,
      selected_offer_id: ret.selected_offer,
    });
  }

  async delete(req, res) {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(400).json({ error: 'Order does not exists' });
    }

    const { userId } = req;

    if (order.user_id !== userId) {
      return res.status(401).json({ error: 'Request unauthorized' });
    }

    await order.destroy();
    return res.send();
  }

  /* async index(req, res) {
    const { userId } = req.params;

    const orders = (await Order.findAll({
      where: { user_id: userId },
    }));

    return res.send(orders);
  } */

  async findOne(req, res) {
    const { orderId } = req.params;

    const order = await Order.findOne({
      where: { id: orderId },
    });

    const orderFiles = await File.findAll({
      where: { order_id: orderId },
    });

    if (order) {
      return res.json({
        order,
        orderFiles,
      });
    }

    return res.status(400).json({ error: 'Order does not exist' });
  }

  async show(req, res) {
    const { contractor } = await User.findByPk(req.userId);

    const whereOrder = {};

    if (contractor) whereOrder.user_id = req.userId;

    if (req.query.dueDate) {
      // eslint-disable-next-line no-use-before-define
      if (!isValidDate(req.query.dueDate)) {
        return res.status(400).json({ error: 'Due date is invalid' });
      }

      whereOrder.due_date = req.query.dueDate;
    }

    if (req.query.studyArea) whereOrder.study_area = req.query.studyArea;

    if (req.query.educationLevel) whereOrder.education_level = req.query.educationLevel;

    if (req.query.status) whereOrder.status = req.query.status;

    let orders;

    // eslint-disable-next-line no-use-before-define
    if (await isEmpty(whereOrder)) {
      orders = await Order.findAll({
        include: [{
          model: Offer,
          as: 'selected_offer',
          attributes: ['id', 'value', 'description', 'provider_id'],
        }],
        where: Sequelize.or(
          { status: [1] },
          Sequelize.literal(`"selected_offer"."provider_id" = ${req.userId}`),
        ),
      });
      return res.json(orders);
    }

    if (!(contractor)) {
      orders = await Order.findAll({
        include: [{
          model: Offer,
          as: 'selected_offer',
          attributes: ['id', 'value', 'description', 'provider_id'],
        }],
        where: Sequelize.and(whereOrder, Sequelize.or(
          { status: [1] },
          Sequelize.literal(`"selected_offer"."provider_id" = ${req.userId}`),
        )),
      });
      return res.json(orders);
    }

    orders = await Order.findAll({
      where: Sequelize.and(whereOrder),
    });
    return res.json(orders);
  }

  async canBid(req, res) {
    const order = await Order.findByPk(req.params.orderId);
    const user = await User.findByPk(req.params.userId);


    if (!(order && user)) {
      return res.status(400).json({ error: 'There is no corresponding Order or User' });
    }

    let isBid = true;

    const whereOrder = {};

    whereOrder.user_id = req.params.userId;
    whereOrder.id = req.params.orderId;


    const isOrder = await Order.findOne({
      where: whereOrder,
    });

    if (isOrder) isBid = false;

    return res.json(isBid);
  }
}


export default new OrderController();

function isValidDate(dateString) {
  const regEx = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regEx)) return false; // Invalid format
  const d = new Date(dateString);
  const dNum = d.getTime();
  if (!dNum && dNum !== 0) return false; // NaN value, Invalid date
  return d.toISOString().slice(0, 10) === dateString;
}
function isEmpty(obj) {
  // eslint-disable-next-line no-restricted-syntax
  for (const prop in obj) {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(prop)) { return false; }
  }
  return true;
}
